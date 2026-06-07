# Lalabuba — Claude Code Instructions

## Project overview
Lalabuba is a kids AI coloring web app. Vanilla JS ES modules + HTML5 Canvas.
Server: `server.js` (local dev), `api/generate-image.js` (Vercel serverless).
Mobile: Capacitor 8.3.0 → iOS (Codemagic) + Android (GitHub Actions).

## CSS versioning
All `<link>` tags in `public/index.html` use `?v=NNN`. Bump `NNN` by 1 on every deploy so browsers fetch fresh assets. Current version is tracked in `index.html` — grep for `?v=` to find it.

## Key state: hero vs coloring
`.app.app-hero` on the root div = landing page state.
`generate.js` removes `app-hero` before the first draw — that switches layout to coloring mode.
CSS uses `.app.app-hero` and `.app:not(.app-hero)` to show/hide sections per state.

---

## CSS change discipline (REQUIRED before writing any CSS)

Before writing or editing any CSS rule, explicitly audit:
1. All existing rules targeting the same element (class, id, tag, state variants)
2. Rules on parent containers that constrain children (overflow, flex, grid, position)
3. `.app.app-hero` and `.app:not(.app-hero)` variants — does the rule apply in both states?
4. Media queries and container queries that modify any of the above
5. Non-inheriting properties that must be set directly: `touch-action`, `pointer-events`, `z-index` stacking contexts

Edge cases to reason through before writing: 375px viewport, text wrapping at 2× expected length, 6+ flex items, keyboard-open viewport shrink, iOS safe-area-inset.

## Claim discipline (REQUIRED for every fix)

After every fix, state exactly:
1. What bug existed (specific wrong code path)
2. What changed (specific file:line)
3. Full call chain from user action to visible result
4. What is NOT verifiable without a running browser (be explicit)

Never say "tested", "working", "QA passed". Only say "code-traced" for logic you actually traced end-to-end.

---

## Deploy + QA routine (REQUIRED after every change)

### 1. Bump version
```powershell
(Get-Content "public\index.html" -Raw) -replace '\?v=NNN', '?v=NNN+1' | Set-Content "public\index.html" -NoNewline
```

### 2. Commit and push
```bash
git add <changed files> public/index.html
git commit -m "description\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

### 3. Confirm Vercel deployed
```powershell
# Wait ~20s then check:
$headers = @{ "Authorization" = "Bearer $token"; "Accept" = "application/vnd.github+json" }
$dep = Invoke-RestMethod "https://api.github.com/repos/botwa2000/lalabuba/deployments?per_page=1" -Headers $headers
$st  = Invoke-RestMethod "https://api.github.com/repos/botwa2000/lalabuba/deployments/$($dep[0].id)/statuses" -Headers $headers
Write-Host "$($dep[0].sha.Substring(0,7)): $($st[0].state)"   # must be "success"
```

### 4. Verify live assets
Fetch `https://lalabuba.com/css/hero.css?v=NNN` and `https://lalabuba.com/js/main.js?v=NNN` — confirm new version number and the specific lines changed.

### 4b. Visual screenshot QA (REQUIRED for any HTML/CSS/layout change)

Run Playwright screenshots and READ every image before proceeding:
```powershell
$env:NODE_PATH = "C:\Users\Alexa\lalabuba\scripts\node_modules"
node scripts/screenshot-qa.js https://lalabuba.com
```
Screenshots saved to `public/mockups/`. Read each PNG with the Read tool and inspect for:
- Overlapping or clipped elements
- Oversized or undersized components
- Misaligned layout at each viewport
- Any element that should be visible but isn't

Viewports captured: desktop (1440×900), mobile-portrait (390×844), mobile-landscape (844×390).

If any screenshot shows a layout problem: fix it, redeploy, re-run screenshots. Do NOT skip this step or report done without reviewing all three screenshots.

### 5. Functional QA checklist — check EVERY item on web before reporting done

**Hero state (landing page):**
- [ ] 4 suggestion cards visible, 1 row desktop / 2×2 mobile
- [ ] Shuffle button (🎲) deals in a new set of 4 cards with animation
- [ ] Daily word pill shows (if available) and fills input on click
- [ ] Typing in search bar enables Draw! button
- [ ] Surprise me (💡) fills a random subject
- [ ] Difficulty pills (Easy/Medium/Hard/Extreme) select correctly
- [ ] Settings chips (⭐⭐, 🎨12, 🖍️, 🔢) cycle their values
- [ ] Help panel (❓) opens and closes
- [ ] Gallery (🖼️) opens gallery modal
- [ ] Theme toggle (🌙/☀️) switches dark/light
- [ ] Language picker opens dropdown; changing language updates all text
- [ ] Canvas area below shows empty placeholder (🖌️ hint)

**After clicking Draw! (coloring state):**
- [ ] Hero heading, sub-heading, and cards are HIDDEN — form is immediately visible without scrolling
- [ ] Loading overlay appears with bouncing dots
- [ ] Image renders in canvas
- [ ] Coloring hint banner shows
- [ ] Palette sidebar shows color swatches (not huge boxes)
- [ ] Tapping a color swatch selects it (active ring)
- [ ] Tapping a numbered region fills it with the selected color
- [ ] Undo button works
- [ ] Tap/Paint mode toggle works
- [ ] ✏️ Draw mode activates pencil overlay
- [ ] 🖨️ Print opens print dialog
- [ ] 💾 Save downloads the image
- [ ] 🏆 Challenge generates QR/share link
- [ ] 🖼️ Share art shares the artwork
- [ ] 🎲 Again! generates a new image with same subject
- [ ] Settings chips still work to change options

**Mobile (portrait, ≤767px):**
- [ ] Hamburger ☰ opens config panel drawer on single tap
- [ ] Panel closes when tapping outside
- [ ] Drawing (pencil/paint) works — strokes register correctly

**Mobile (landscape, phones ≤500px height):**
- [ ] Config panel visible as left sidebar (not hidden)
- [ ] Canvas fills remaining width
- [ ] No layout overlap

**Config panel (sidebar, desktop):**
- [ ] ◀ collapse button hides panel; ▶ expands it
- [ ] Collapsed panel shows toggle button only

### 6. If anything is wrong
Fix the bug, increment version again, commit, push, wait for deploy, re-run the relevant QA checks. Repeat until clean. Do NOT report done until all checklist items pass.
