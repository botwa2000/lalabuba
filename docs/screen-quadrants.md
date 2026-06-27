# Lalabuba — Screen Quadrant Map & UI Placement Standard

> Every UI element has an assigned home quadrant per device mode.
> New features MUST be placed here before implementation.

---

## Grid System

Screens are divided into a **3-column × 6-row** logical grid.

```
Columns:  LEFT (L)   |   CENTRE (C)   |   RIGHT (R)
Rows:     A (top ~8%)
          B (~8–25%)
          C (~25–45%)
          D (~45–65%)
          E (~65–85%)
          F (bottom ~85–100%)
```

Cell references: `A-L`, `A-C`, `A-R`, `B-L`, `B-C`, `B-R`, … `F-L`, `F-C`, `F-R`

---

## 1. Desktop Web (≥1024px wide)

### 1.1 Hero State

| Cell | Element | Notes |
|---|---|---|
| A-L | (empty) | Reserve for future breadcrumb / back |
| A-C | Logo + tagline | Logo image left of "Lalabuba" wordmark |
| A-R | Journal 🏆, Gallery 🖼️, Settings ⚙️ | Right-aligned, equal spacing, 40px tap targets |
| B-C | Search bar (full-width up to 700px) | Centred, prominent border |
| B-R | Draw! button | Attached to right of search bar |
| C-C | Chip row: Surprise me 💡, Say it 🎤, Daily word 🌟, Scenes | Centred, wrapping pill buttons |
| D-C | Difficulty pills: Easy / Medium / Hard / Extreme | Centred single row |
| D-C | Settings chips: ⭐ Stars, 🎨 Palette, 🔢 Numbers, 🔊 Sound, 🗣️ Narrate | Second line below difficulty |
| E-C | "or pick something fun" divider | |
| E-L/C/R | 4 suggestion cards (equal columns) | |
| F-C | Shuffle button 🎲 | Below cards, centred |
| F-C | Cookie banner (first visit only) | Absolute bottom bar |

### 1.2 Coloring State

| Cell | Element | Notes |
|---|---|---|
| A-L | Panel collapse ◀ / expand ▶ | Fixed, 40px wide |
| A-C | Logo (compact) | Centred, smaller than hero |
| A-R | Journal 🏆, Gallery 🖼️, Settings ⚙️ | Same as hero |
| B-L | Config panel: difficulty, palette, background, frame selector | Collapsible sidebar, 260px wide |
| B-C | Toolbar: New, Undo, I'm finished!, [sep], Numbers, Free!, [sep], Tap, Pencil, Brush🔒, [sep], Print, Save, Share, Challenge | Single row, scrollable |
| B-C | Coloring hint banner | Below toolbar, auto-dismiss |
| C-E / C | Canvas | Centred, fills available width |
| C-E / C | Zoom controls (+, fit, –, hand) | Top-right of canvas, inset |
| B-R / C-R | Palette sidebar: colour swatches (3 col), ERASE | Fixed right, 140px |

---

## 2. Mobile Portrait (≤767px)

### 2.1 Hero State

| Cell | Element | Notes |
|---|---|---|
| A-L | ☰ Hamburger | 44×44px tap target, vertically centred in A row |
| A-C | Logo | Centred |
| A-R | Gallery 🖼️, Settings ⚙️ | Right-aligned, same vertical centre as hamburger |
| B-C | Search bar (full-width) | |
| B-R | Draw! button | Inline right of search bar, or below on very small screens |
| C-C | Chip row (Surprise me, Say it, Daily word) | Centred, wrapping |
| D-C | Difficulty pills (2 per row on ≤390px) | |
| D-C | Settings chips (same row or wrap) | |
| E-L/R | 2×2 suggestion card grid | |
| F-C | Shuffle 🎲 | Below cards |

### 2.2 Coloring State

| Cell | Element | Notes |
|---|---|---|
| A-L | ☰ Hamburger (opens config drawer) | 44×44px |
| A-C | Logo (compact) | |
| A-R | Gallery 🖼️, Settings ⚙️ | |
| B-C | Toolbar row 1: New, Undo, I'm finished!, ⋯ More | Single scrollable row |
| C-E / C | Canvas (full-width) | Fills all available height |
| Drawer | Config panel (off-canvas left, slides in on ☰) | Contains: difficulty, palette, background, frame, counts |

---

## 3. Mobile Landscape (≤500px height)

### 3.1 Coloring State

| Cell | Element | Notes |
|---|---|---|
| A-C | Toolbar: all buttons in single scrollable row | No wrap, `overflow-x: auto` |
| B-L | Config sidebar (always visible, ≤180px wide) | Not drawer; always shown |
| B-C/R | Canvas (fills remaining width) | |
| B-R | Palette (compact vertical strip, 2 cols) | Overlays right edge or integrated |

---

## 4. Tablet Portrait (768–1023px)

| Cell | Element |
|---|---|
| A-L/C/R | Header (same as desktop) |
| B-L | Config sidebar (220px) |
| B-C/R | Canvas + palette (2-col split) |
| Bottom | Toolbar (full-width) |

---

## 5. Known Issues to Fix (§1 from main request)

| Issue | Current | Correct quadrant | Priority |
|---|---|---|---|
| Mobile hero: Gallery + Settings misaligned | Gallery ~2px off vertical | Both must share A-R row, `align-items: center` | P1 |
| Landscape panel: hide/show button skewed | Absolute position inaccurate | Fixed to left edge of config sidebar at mid-height | P1 |
| Mobile portrait: chips overflow on small screens | Chips wrap inconsistently | `flex-wrap: wrap; justify-content: center` on chip containers | P2 |

---

## 6. Placement Rules for New Features

Before implementing any new button/control, answer:
1. Which state does it belong to? (hero / coloring / both)
2. Which device modes need it? (desktop / portrait / landscape / tablet)
3. Which cell does it live in per the tables above?
4. Is it always visible or behind ⋯ More overflow?
5. What is the minimum tap target? (must be ≥44×44px on mobile)
6. Does it need a locked state? If so, where is the lock badge?

### 6.1 New features assigned

| Feature | State | Desktop cell | Mobile cell | Notes |
|---|---|---|---|---|
| Art mode (Structured/Artistic) | Hero + regen | B-C (chip or pill near Draw!) | B-C (hero chips) | Toggle before drawing |
| Background color picker | Coloring | B-L (config sidebar) | Drawer | After image loads |
| Canvas shape selector | Hero + coloring | B-L (config sidebar) | Drawer | Before drawing is ideal |
| Canvas frame selector | Coloring | B-L (config sidebar) | Drawer | Can change after drawing |
