# Lalabuba Social Content Manifest

Generated: 2026-08-08 · Updated: 2026-09-20 (pins v2 + carousel v2 rewrite)  
Generator scripts: `scripts/make-social-pins.js`, `scripts/make-social-carousel.js`, `scripts/make-social-videos.js`, `scripts/social-lib.js` (shared text/callout rendering)

---

## Text rendering (applies to Phases 1 & 2, since 2026-09-20)

All text in pins and the how-it-works-v2 carousel renders through
`scripts/social-lib.js`'s `renderText()`, which loads a bundled `.ttf`
directly via `sharp`/Pango (`flutter_app/google_fonts/`) — never an SVG
`<text font-family="...">` host-font lookup. A sibling pipeline (Bonifatus),
built the exact same way with SVG text, shipped ten misspelled German words
to a live account and had to be deleted. Regression fixture:
`scripts/test-social-diacritics.js` → `docs/social-content/diacritics-regression-fixture.png`
(committed; run the test whenever `social-lib.js` or the bundled fonts
change). Wrapping also goes through Pango's real text-layout engine
(`sharp.text({width, wrap:'word'})`) instead of SVG's non-wrapping `<text>`.

---

## Phase 1 — Pinterest Pins

Format: 1000×1500 px PNG (2:3 portrait)  
Location: `docs/social-content/pins/`  
Layout: accent brand bar → keyword headline → colored "after" image (flood-filled from line art) → before/after strip → lalabuba.com pill

| File | Topic | Headline | Source image | Accent |
|------|-------|----------|-------------|--------|
| `pin_dinosaur.png` | Dinosaur (EN) | Dinosaur Coloring Pages | `dinosaur-easy-1704707776.png` | Deep Green |
| `pin_cat.png` | Cat (EN) | Cat Coloring Pages | `cat-easy-1005447403.png` | Deep Orange |
| `pin_unicorn.png` | Unicorn (EN) | Unicorn Coloring Pages | `unicorn-easy-282889560.jpg` | Deep Purple |
| `pin_rocket.png` | Rocket (EN) | Rocket Coloring Pages | `rocket-easy-1224668489.png` | Deep Blue |
| `pin_butterfly.png` | Butterfly (EN) | Butterfly Coloring Pages | `butterfly-easy-351931874.png` | Deep Pink/Magenta |
| ~~`pin_schultuete.png`~~ | ~~Schultüte (DE)~~ | RETIRED 2026-08-09 — duplicate of pin already posted 8/5; flood-fill leaked through outline gaps on all attempts. Do not rebuild. | — | — |
| `pin_einschulung.png` | Einschulung (DE) | Einschulung Ausmalbilder | `einschulung-easy-1520158737.png` | Deep Teal |

**Sources:** `docs/coloring-page-library/{topic}/` (1024×1024 or 768×768)  
**Colored "after":** flood-fill BFS from actual line art (same image, not different art)  
**BFS options:** einschulung uses `noFill: true` — blank line-art hero, zero flood fill (proven format; top pin by 7×). schultuete RETIRED.
**Rule:** never use library images containing rendered text/letters for pins — AI text is almost always mangled.  
**Regenerate:** `node scripts/make-social-pins.js` (all) or `node scripts/make-social-pins.js dinosaur` (single)

---

## Phase 2 — How-To Carousel (v2)

Format: generated at BOTH target sizes from the same layout logic — never one
cropped into the other:
- Instagram: 1080×1350 px PNG (4:5) → `docs/social-content/carousels/how-it-works-v2/ig/`
- Pinterest: 1000×1500 px PNG (2:3) → `docs/social-content/carousels/how-it-works-v2/pin/`

**v2 rewrite (2026-09-20)** fixed three defects in the original
`carousels/how-it-works/` (v1, superseded but left on disk, not deleted):
1. v1's bottom gradient text band laid the headline ON TOP of the screenshot,
   slicing through the idea-card grid on one slide and the coloring canvas on
   another. v2 uses a strict header-zone (solid color, text) / content-zone
   (screenshot, always fully visible, never occluded) split.
2. v1's SVG `<text font-family="...">` depended on host fonts — see the "Text
   rendering" section above.
3. v1's SVG `<text>` never wrapped. v2 wraps via Pango and checks every
   headline with `assertFits()`.

Also fixed during the v2 build (found by viewing every rendered frame, not
just running the script): screenshot crop windows must be measured by
pixel-scanning the actual source PNG, not by eyeballing the *displayed*
screenshot's coordinates and multiplying by the display scale factor — that
approach was off by hundreds of pixels on one slide and silently dropped a
whole feature row on another. And any slide with a card/grid tall enough to
reach the footer pill's territory needs that pill height explicitly reserved
out of its layout bound (not just its size budget) — centering a shrunk
budget only returns half the saved space as clearance below.

| File | Slide | Content |
|------|-------|---------|
| `slide_01_hook.png` | Hook | Fully colored triceratops — "Type Any Idea." |
| `slide_02_step1.png` | Step 1 | Real app screenshot (search + settings panel) — "Type What You Want" |
| `slide_03_step2.png` | Step 2 | Real app screenshot (loading animation) — "AI Draws It Instantly" |
| `slide_04_step3.png` | Step 3 | Real app screenshot (color-by-number canvas) — "Color By Number" |
| `slide_05_cta.png` | CTA | 2×2 grid of colored art — "Kids Love It!" |

**Sources slides 2-4:** Real Flutter app screenshots (`store_assets/raw/phone_*.png`), cropped by pixel-verified y-ranges (see comments in `slideStep1`/`slideStep2`/`slideStep3` in the script) — never a generic "top N%" crop.  
**Regenerate:** `node scripts/make-social-carousel.js`

---

## Phase 3 — Videos

Format: 1080×1920 px MP4, H.264, yuv420p, 30fps (9:16 portrait — Instagram Reels, TikTok, Pinterest)  
Location: `docs/social-content/videos/`  
Poster frames: `docs/social-content/videos/posters/` (1080×1350, cropped from center of 1080×1920)

| File | Duration | Size | Content |
|------|----------|------|---------|
| `01_type_to_page.mp4` | 16s | 1.6 MB | Home → loading → canvas (Ken Burns zoom) |
| `02_satisfying_coloring.mp4` | 22s | 241 KB | Progressive BFS flood-fill of dinosaur line art |
| `03_rewards_journey.mp4` | 21s | 2.9 MB | Canvas → journal → treehouse rewards screen |

| Poster File | For Video |
|-------------|-----------|
| `poster_01_type_to_page.png` | 01_type_to_page.mp4 |
| `poster_02_satisfying_coloring.png` | 02_satisfying_coloring.mp4 |
| `poster_03_rewards_journey.png` | 03_rewards_journey.mp4 |

**Technique:**  
- Videos 1 & 3: ffmpeg zoompan filter (Ken Burns slow zoom) on Flutter phone screenshots  
- Video 2: Node.js progressive BFS flood-fill → 660 PNG frames → ffmpeg H.264  
- All transitions: xfade crossfade (0.5s)

**Regenerate:** `node scripts/make-social-videos.js` (all) or `node scripts/make-social-videos.js 2` (single)

---

## Keywords / Captions

**EN (Pinterest/Instagram):**
- `#coloringpages #kidsactivities #coloringforkids #freeprintables #aiart #lalabuba`
- `#dinosaurcoloringpage #unicorncoloringpage #catcoloringpage`
- `Type any word → get a coloring page instantly. Free. No account. No ads. 🖍`

**DE (Pinterest DE):**
- `#Ausmalbilder #Ausmalen #Kinder #Einschulung #Schultüte #kostenlos`
- `Einfach ein Wort tippen — die KI erstellt ein Ausmalbild. Kostenlos. Ohne Anmeldung.`

---

## File Structure

```
docs/social-content/
├── manifest.md                           ← this file
├── diacritics-regression-fixture.png     ← committed test fixture, see "Text rendering" above
├── pins/
│   ├── pin_dinosaur.png                  (1000×1500)
│   ├── pin_cat.png                       (1000×1500)
│   ├── pin_unicorn.png                   (1000×1500)
│   ├── pin_rocket.png                    (1000×1500)
│   ├── pin_butterfly.png                 (1000×1500)
│   └── pin_einschulung.png               (1000×1500)
│   ⚠  pin_schultuete.png                RETIRED — deleted 2026-08-09
├── carousels/
│   ├── how-it-works/                     ← v1, SUPERSEDED (see Phase 2), left on disk
│   │   ├── slide_01_hook.png             (1080×1350)
│   │   ├── slide_02_type.png             (1080×1350)
│   │   ├── slide_03_generate.png         (1080×1350)
│   │   ├── slide_04_color.png            (1080×1350)
│   │   └── slide_05_cta.png              (1080×1350)
│   └── how-it-works-v2/                  ← current
│       ├── ig/  (1080×1350 × 5 slides)
│       └── pin/ (1000×1500 × 5 slides)
└── videos/
    ├── 01_type_to_page.mp4               (1080×1920, 16s)
    ├── 02_satisfying_coloring.mp4        (1080×1920, 22s)
    ├── 03_rewards_journey.mp4            (1080×1920, 21s)
    └── posters/
        ├── poster_01_type_to_page.png    (1080×1350)
        ├── poster_02_satisfying_coloring.png (1080×1350)
        └── poster_03_rewards_journey.png (1080×1350)
```
