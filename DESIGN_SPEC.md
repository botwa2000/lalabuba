# Lalabuba — Design & Build Spec (the blueprint we build from)

> Written after an objective re-review of the whole scope against the app's
> ultimate purpose. This is the single source of truth for *what* we build and
> *how it's laid out*. Build on `dev.lalabuba.com`, evaluate, promote to prod.

## 1. The ultimate objective (North Star)

Lalabuba exists to **maximize a child's create → color → finish → collect →
return loop**, in a way that is **visibly valuable and unmistakably safe to the
parent**, so that value converts into **parent-paid revenue** (subscription +
physical prints) at low acquisition cost (sharing) and high lifetime value
(habit + collection).

Two engines, and **every element must serve one of them**:
- **Child engagement engine:** reduce friction to create → amplify the reward of
  finishing → build a collection that pulls them back tomorrow.
- **Parent value→conversion engine:** make the child's creativity and the app's
  safety *visible* to the parent → convert that emotion into upgrade/print, always
  behind a parental gate, never by pressuring the child.

**The canvas is king.** Creation and coloring are the product; everything else is
a peripheral affordance that serves the loop or the parent. If a feature or pixel
doesn't advance an engine, it doesn't ship.

## 2. Objective review — gaps in the prior plan, now corrected

Re-examining the earlier retention/monetization plan against the North Star
surfaced things it under-weighted (fixing now to avoid rework):

1. **Activation / first draw was missing.** The single biggest lever is a child
   getting their first delightful image in seconds, zero config. → Add a
   one-tap "draw this" first-run path (Picture-of-the-Day / tap-a-card-and-go).
2. **The wait was treated as dead time.** Generation is 10–30s — an eternity for
   a kid. → The loading state becomes *delightful* (playful progress + "drawing
   your dinosaur…"), protecting the loop from drop-off.
3. **The completion moment wasn't centered.** It's the emotional peak where
   retention is forged. → Make it the centerpiece: celebrate → reveal sticker →
   "Added to your Journal!" → immediate **what-next** (Again / New / Share /
   Print). This closes the loop back to creation.
4. **Sharing was framed as a feature, not the growth engine.** A shared/printed
   artwork markets the app. → Make share/print frictionless and beautiful; the
   artifact carries light Lalabuba branding.
5. **Trust/safety was treated as compliance, not a selling point.** "Ad-free,
   private, COPPA-safe" is a *conversion* argument to parents. → Surface it in the
   Parent Zone and at the paywall.
6. **Screen real-estate discipline was unstated** — the very thing that made
   past layouts wrong (oversized chips, canvas crowded). → Codified in §3.
7. **Accessibility & sensory delight were absent.** Large tap targets, colorblind-
   safe palette, reduced-motion, optional sound/haptic on fill/complete. → Added.
8. **Monetization framing risked harming the loop.** A cap that frustrates a child
   kills retention. → Free tier must be generous enough to build habit *first*;
   the limit is parent-facing, positive, and only ever shown behind the gate.

## 3. Design discipline (applies to every screen)

- **Canvas-dominant:** in coloring state the artwork occupies ≥ ~70% of the
  viewport; controls are compact and edge-docked. Never let chrome crowd the art.
- **Proportionate to purpose:** primary action (Draw! / Again!) is the largest,
  warmest control; secondary actions smaller; palette swatches are a tidy grid of
  small-medium chips (not big boxes); decorative chrome is minimal. Tap targets
  ≥ 44px for little fingers even when visually small.
- **Three config groups — never intermixed:**
  1. **Create** (what to draw): subject input, suggestions, difficulty, size.
  2. **Color** (how to color): palette, color count, tap/paint, pencil, undo.
  3. **App/Parent** (settings): theme, language, help, Parent Zone → in the ⚙️
     gear menu (the adult corner).
- **Two audiences, separated:** kid surfaces carry zero purchase pressure;
  every purchase/parent/external surface sits behind the parental gate.
- **Each sector earns its space:** top bar = identity + journal + settings only;
  center = the active task (create on landing, color in coloring); edges = tools.
  No dead zones, no oversized hero eating the fold on mobile.
- **Security & privacy by default:** no third-party trackers/ads ever; anonymous
  local-only child data; parental gate before any data/purchase action.

## 4. Screen blueprint (web — built first on dev)

**Landing (hero)** — goal: fastest possible first draw.
- Top bar: logo (left); right cluster = 🖼️ Journal (badge dot when a new sticker
  waits) + ⚙️ gear. A small 🌱 "days colored" pill near the Journal icon.
- Center, in priority order: **Picture-of-the-Day** featured tile (one-tap draw) ·
  subject input (full row) · Surprise 💡 + **Draw!** (Draw largest) · 4 suggestion
  cards (1 row desktop / 2×2 phone) · difficulty pills (2×2 phone) · compact
  create-settings (size, colors) as small chips.
- Below the fold: empty canvas hint. Footer (store badges) reachable on mobile.

**Coloring** — goal: protect and reward the creation loop.
- Canvas dominant, centered.
- Palette docked: right sidebar (desktop) / bottom strip (phone) — small swatches,
  clear active ring.
- Toolbar grouped: **left = tools** (undo, tap/paint, pencil); **right = output**
  (save, print/PDF, challenge, share, Again!). Again! is prominent.
- Create+Color config: collapsible sidebar (desktop) / hamburger drawer (phone).
- **Loading:** playful progress + contextual line, never a bare spinner.
- **Completion:** celebration overlay → sticker/badge reveal → "Added to your
  Journal!" → what-next row [Again] [New] [Share] [Print].

**My Journal (🖼️)** — goal: the collection that pulls them back.
- Header: "🎨 N masterpieces!" + horizontal **sticker/badge shelf**.
- Art grid (2 cols phone / 3–4 desktop). Multi-select → **Make a coloring book**
  (PDF). Tap art → fullscreen → recolor / share / print / delete.

**Parent Zone (⚙️ → 👨‍👧, parental-gated)** — goal: surface value → convert.
- "What your child made" (pictures, time, badges) — **value first**.
- Manage plan / Upgrade (dormant at launch). Content controls. Privacy
  (export / delete). Email digest opt-in (email-plus consent). **Trust statement**
  (ad-free · private · COPPA-safe).

**Paywall (dormant, parental-gated, at cap-hit):** "You've made N today! 🎉
Unlock unlimited." At launch this is replaced by a no-pressure "Come back
tomorrow for more!" — the child is never blocked harshly.

## 5. Build order (dependency-first, to minimize rework)

1. **Design-system & layout foundation** — tokens, spacing, proportions, the 3
   config groups, canvas-dominant grid. *(Everything sits on this — do it first.)*
2. **Local progress store** — saved-art + day-count + badges (anonymous, local).
3. **Completion celebration + auto-save + what-next loop.**
4. **My Journal** (album + sticker shelf + coloring-book PDF).
5. **Daily ritual** (Picture-of-the-Day + days-colored) + first-draw activation.
6. **Delightful loading.**
7. **Parent Zone** (gated) + trust + **dormant paywall** + entitlement gating.
8. **Unlockables / seasonal / mystery-mode.**
9. **Backend: admin config panel + Postgres + monetization wiring** (own phase).

Each step ships to `dev.lalabuba.com` for evaluation, then `deploy.sh prod`.
Accessibility (targets, colorblind palette, reduced-motion, optional sound/haptic)
and the security guardrails (§3) are checked into *every* step, not bolted on.
