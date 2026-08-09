# Lalabuba Social Content Manifest

Generated: 2026-08-08  
Generator scripts: `scripts/make-social-pins.js`, `scripts/make-social-carousel.js`, `scripts/make-social-videos.js`

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
| `pin_schultuete.png` | Schultüte (DE) | Schultüte Ausmalbilder | `schultuete-easy-1313383578.png` | Deep Red |
| `pin_einschulung.png` | Einschulung (DE) | Einschulung Ausmalbilder | `einschulung-easy-1520158737.png` | Deep Teal |

**Sources:** `docs/coloring-page-library/{topic}/` (1024×1024 or 768×768)  
**Colored "after":** flood-fill BFS from actual line art (same image, not different art)  
**BFS options:** schultuete + einschulung use `skipExterior: true`; schultuete uses `forcedColors` to set cone body deep-red; einschulung uses `faceZones` (full-body, overlap-checked) to leave all person regions white  
**Regenerate:** `node scripts/make-social-pins.js` (all) or `node scripts/make-social-pins.js dinosaur` (single)

---

## Phase 2 — How-To Carousel

Format: 1080×1350 px PNG (4:5 portrait, Instagram standard)  
Location: `docs/social-content/carousels/how-it-works/`

| File | Slide | Content |
|------|-------|---------|
| `slide_01_hook.png` | Hook | Fully colored dinosaur — "Turn Any Idea Into a Coloring Page" |
| `slide_02_type.png` | Step 1 | Flutter app home — "Type What You Want" |
| `slide_03_generate.png` | Step 2 | Loading state — "AI Creates It Instantly" |
| `slide_04_color.png` | Step 3 | Color canvas with monkey — "Color It Your Way" |
| `slide_05_cta.png` | CTA | 2×2 grid of colored art — "Kids Love It!" |

**Sources slides 2-4:** Real Flutter app screenshots (`store_assets/raw/phone_*.png`)  
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
├── pins/
│   ├── pin_dinosaur.png                  (1000×1500)
│   ├── pin_cat.png                       (1000×1500)
│   ├── pin_unicorn.png                   (1000×1500)
│   ├── pin_rocket.png                    (1000×1500)
│   ├── pin_schultuete.png                (1000×1500)
│   └── pin_einschulung.png               (1000×1500)
├── carousels/
│   └── how-it-works/
│       ├── slide_01_hook.png             (1080×1350)
│       ├── slide_02_type.png             (1080×1350)
│       ├── slide_03_generate.png         (1080×1350)
│       ├── slide_04_color.png            (1080×1350)
│       └── slide_05_cta.png             (1080×1350)
└── videos/
    ├── 01_type_to_page.mp4               (1080×1920, 16s)
    ├── 02_satisfying_coloring.mp4        (1080×1920, 22s)
    ├── 03_rewards_journey.mp4            (1080×1920, 21s)
    └── posters/
        ├── poster_01_type_to_page.png    (1080×1350)
        ├── poster_02_satisfying_coloring.png (1080×1350)
        └── poster_03_rewards_journey.png (1080×1350)
```
