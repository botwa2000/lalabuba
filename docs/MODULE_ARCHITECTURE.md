# Module Architecture: Drawing / Coloring / Config

> Companion to `PLATFORM_ARCHITECTURE.md` (which covers URLs/nav/accounts —
> an unrelated set of concerns). This doc is intentionally thin: it points at
> the enforcement mechanisms below rather than restating rules in prose,
> because an unenforced rule is exactly the failure mode this doc exists to
> prevent (see history).

## History

Coloring/tap/numbering broke and got re-fixed ~6+ times in this project's
history (127 matching git commits in 3 months as of 2026-09-20). Root cause:
silent contract drift with no automated enforcement, not bad module
boundaries. See `flutter_app/test/region_detection_regression_corpus_test.dart`
and `flutter_app/test/drawing_config_defaults_test.dart` for the concrete
fixes that came out of that specific investigation.

## The three modules

**Drawing** — `lib/image-providers.js`. Single canonical server-side
implementation (no duplication). Provider waterfall + prompt building +
quality gate. Known open gap: the HuggingFace/nscale fallback tier bypasses
the quality gate — tracked, not yet closed (see TODO below).

**Coloring** — duplicated by necessity (Flutter needs on-device Dart, web
needs in-browser JS): `flutter_app/lib/features/canvas/{flood_fill,
line_bridge,trapped_ball}.dart` and `public/js/{outline-mask,line-bridge,
trapped-ball,fill-core,region-worker}.js`. Each runs thread-isolated already
(`dart:isolate` / Web Worker) — that part is fine. The actual risk is
**behavioral drift between the two ports**, enforced by:
- `flutter_app/test/region_detection_regression_corpus_test.dart` — every
  real image that ever broke coloring lives in
  `test/fixtures/regression_corpus/*.rgba` permanently; this test asserts
  detection completes fast, produces regions, produces numbered regions, and
  fully tiles the image. **Rule: any fix to a real coloring bug adds the
  reproducing image here, not just a synthetic mimic.** Runs in CI
  (`flutter-ci.yml`) on every push.
- `scripts/test-parity-corpus.mjs` + `flutter_app/test/parity_corpus_test.dart`
  — cross-checks the Dart and JS engines against the same corpus images
  (loose order-of-magnitude tolerance, not byte-identical — see that
  script's header for why). **Not yet wired into automatic CI** (would need
  cross-workflow artifact hand-off between `flutter-ci.yml` and
  `node-ci.yml`); run manually per that script's header until someone
  builds that. Found and fixed one real capability gap already: Dart lacked
  the "thin-wall merge" stage JS has had for a while (`flood_fill.dart`
  step 6b / `region-worker.js` step 8) — ported 2026-09-20.
- **Open finding, not yet resolved**: the two platforms compute region-size
  filtering through genuinely different, independently-evolved concepts —
  `detection.regionFilter.absoluteFloor` (which region-worker.js actually
  reads) vs. Flutter's `difficulties.{difficulty}.minArea` (baked directly
  into `detectRegions`' region-keeping) vs. web's OWN separate
  `scaledMinArea` (`public/js/canvas.js`, used only for number-badge
  placement density on a legacy main-thread path, not fill eligibility).
  These are not currently reconciled and nothing tests that they should
  produce equivalent difficulty-scaled behavior across platforms. Flag for
  a dedicated investigation before touching difficulty tuning on either
  side.

**Config** — `lib/drawing-config.js`. Genuinely a single source of truth
already: server `require()`s it directly, DB-overridable via
`/api/admin/drawing-config`, both clients fetch `/api/drawing-config` at
startup. Enforced by:
- `scripts/generate-config-snapshot.mjs` generates
  `flutter_app/test/fixtures/drawing_config_defaults_snapshot.json` from the
  server's canonical `DEFAULTS`. `flutter_app/test/drawing_config_defaults_test.dart`
  asserts Flutter's hand-written fallback (`DrawingConfig.defaults`, used
  only when the network fetch fails) still matches. **Regenerate the
  snapshot after any change to `lib/drawing-config.js` DEFAULTS.**
  This exact check found two REAL live bugs on first run (2026-09-20):
  `generation.clientTimeoutMs` (150000 server vs. 120000 stale fallback) and
  a dead `skipFreeTiers: true` fallback for hard/extreme that the server had
  deliberately removed (it caused 500s).
- Web's `region-worker.js` `DETECTION_DEFAULTS` fallback is currently only
  checked by eyeballing — not yet covered by an automated diff against the
  server. Smaller blast radius than the Flutter case (web can't silently run
  offline the way a mobile app can), but should get the same treatment if
  this class of bug recurs there.

## Connectivity: drawing → coloring

`POST /api/generate-image` → raw image bytes over HTTP. Clean boundary. Gap:
no explicit, checked contract for the visual properties the drawing module
promises (line thickness, absence of dense near-solid steep-angle fill runs)
that the coloring module's segmentation implicitly assumes. This is what let
a drawing-side provider change (HuggingFace/nscale's solid-stripe art style)
silently break coloring with nothing catching it before a human did.

**TODO (not done in this pass):** extend `checkColoringPageQuality`/
`checkEnclosedRegions` in `lib/image-providers.js` to run for every provider
tier including HuggingFace/nscale (currently the only tier that bypasses the
gate entirely), and consider a narrow structural heuristic for the specific
steep-near-solid-run property that broke things — scoped tightly, not a
general "will this image color well" classifier.
