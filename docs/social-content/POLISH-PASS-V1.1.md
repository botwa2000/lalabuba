# Claude Code Task: Lalabuba social-content polish pass (v1.1 — NOT a full v2)

The 2026-08-08 batch passed review and is being posted. Only 3 files need targeted fixes. Regenerate ONLY these, same filenames/specs, in place. Do not touch any other asset — dinosaur/unicorn/rocket/cat pins, slides 1–3/5, and all videos are approved and partly already scheduled.

1. `pins/pin_einschulung.png` — the flood-fill assigned blue/green/purple to FACES and skin (blue-faced teacher, green/purple children). Make the palette region-aware: skin regions get skin tones (vary them naturally), hair gets hair colors; clothing/background stay playful. If reliable skin-region detection isn't feasible, leave faces/skin UNCOLORED (white) — a partially colored page is on-brand; wrong-colored faces are uncanny for the parent audience.
2. `pins/pin_schultuete.png` — the cone body was left unfilled (renders as background yellow bleeding through). Fill the cone with a real color/pattern (classic Schultüte blue or red) distinct from the yellow backdrop. Also verify no other large region was missed by the fill.
3. `carousels/how-it-works/slide_04_color.png` — two collisions: the "Step 3" badge overlaps the app's back button (move the badge right/down or capture the screenshot with more top margin), and the bottom caption gradient cuts across the artwork mid-canvas, clipping visible color-by-number number badges (crop/frame the screenshot so the artwork ends above the caption band, or shrink the screenshot).

Acceptance: render each fixed image and inspect — no misfilled skin, no unfilled major regions, no element overlaps, caption band doesn't intersect artwork. Update the manifest rows if any description changes. Everything else: unchanged.

Optional (only if quick): note in manifest.md which coloring-library images were used per pin, so the posting automation never builds a duplicate pin from the same source image.

---

# V1.2 ADDENDUM (2026-08-08, after verifying the V1.1 fixes)

`slide_04_color.png` is APPROVED — do not touch. Two items remain:

1. `pins/pin_schultuete.png` — the V1.1 source swap introduced a worse defect: `schultuete-easy-1503201733.png` has garbled AI-generated text baked into the artwork ("SCAHOOL STARTING" — misspelled, and English on a German pin). **New standing rule: never use library images containing rendered text/letters for pins — AI text is almost always mangled. Add this check to source selection.** Fix: go back to a text-free Schultüte source (e.g. the original `schultuete-easy-1484397433.jpg` bow-cone, or scan the schultuete folder for any text-free option) and solve the original problem properly: fill the cone body with a real color distinct from the background (skipExterior handles the outside; the cone interior region must get a palette color, not be skipped).
2. `pins/pin_einschulung.png` — improved (teacher + one child fixed) but two children still have green faces; the fixed exclusion zones miss their bounding boxes. Make it robust instead of hand-tuned: detect ALL regions whose fill would land inside any figure's head area, or — simplest and fully reliable — leave ALL person regions (skin, faces, hands, legs) uncolored white and colorize only clothing, architecture, and background. A half-colored page is on-brand; green faces are not.

Acceptance: no rendered text anywhere in pin artwork; zero non-natural face/skin colors; cone fully filled. Render both and inspect before reporting done.

---

# FINAL DIRECTIVE (2026-08-09, after verifying the second retry) — STOP flood-filling these two pins

Second retry verified and rejected: schultuete's red fill leaked through an outline gap and flooded the background square; einschulung came out almost entirely uncolored (only the sign yellow), defeating the colored-hero layout. Three failed iterations = the approach is wrong, not the parameters. Do this instead:

1. **`pin_schultuete.png` — DEPRIORITIZED, do not rebuild.** A Schultüte pin already published on the account on 8/5. Delete the file or mark it `retired` in the manifest so the posting automation never picks it up.
2. **`pin_einschulung.png` — rebuild with ZERO flood fill, using the proven winning format:** blank line art as the hero (the account's top pin by 7x is uncolored line art — blank IS the desired look for printable-seeking parents). Same pin frame (header "Einschulung Ausmalbilder", footer pill), hero = the clean UNCOLORED einschulung line art, and for the bottom strip either drop the before/after mini-row or keep BEFORE only + "Ausdrucken & Ausmalen" label. No fill code runs at all — this eliminates the whole leak/face-color defect class.
3. Update the manifest accordingly. Acceptance: no colored regions in the hero art, no rendered text in artwork, layout margins as before.
