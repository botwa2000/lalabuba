// progress.js — anonymous, local-only progress store.
//
// This is the foundation the retention loop sits on (DESIGN_SPEC step 2):
//  • masterpiece count, days-colored, streak  → the "pull them back" signals
//  • badges/stickers                          → the reward revealed at completion
//  • daily-create counter (per local day)     → drives the dormant, parent-facing
//                                                cap + "come back tomorrow" — never
//                                                blocks the child harshly.
//
// No network, no identifiers, no third parties. Counters live in localStorage;
// the artworks themselves stay in IndexedDB (gallery.js). Everything degrades
// gracefully if storage is unavailable (private mode, quota) — the loop must
// never break because a counter failed to write.

const KEY = 'lalabuba-progress-v1';

// ── Badge catalogue ──────────────────────────────────────────────────────────
// Each badge has: id, emoji (the sticker art), and a `test(p)` predicate run
// against the progress snapshot AFTER a completion is recorded. i18n strings
// (title/desc) are resolved at display time via `badge.<id>.title|desc`.
export const BADGES = [
  { id: 'first',     emoji: '🌟', test: (p) => p.totalCompleted >= 1 },
  { id: 'five',      emoji: '🖐️', test: (p) => p.totalCompleted >= 5 },
  { id: 'ten',       emoji: '🔟', test: (p) => p.totalCompleted >= 10 },
  { id: 'twentyfive',emoji: '🎨', test: (p) => p.totalCompleted >= 25 },
  { id: 'fifty',     emoji: '🏆', test: (p) => p.totalCompleted >= 50 },
  { id: 'streak3',   emoji: '🔥', test: (p) => p.streak >= 3 },
  { id: 'streak7',   emoji: '⚡', test: (p) => p.streak >= 7 },
  { id: 'streak30',  emoji: '👑', test: (p) => p.streak >= 30 },
  { id: 'explorer',  emoji: '🧭', test: (p) => p.uniqueSubjects >= 10 },
  { id: 'rainbow',   emoji: '🌈', test: (p) => p.hardCompleted >= 1 },
];

function todayKey() {
  // Local calendar day (not UTC) so "today" matches the child's day.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayDiff(a, b) {
  // Whole-day difference between two YYYY-MM-DD keys (b - a).
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((db - da) / 86400000);
}

function fresh() {
  return {
    totalCompleted: 0,
    totalGenerated: 0,
    streak: 0,
    longestStreak: 0,
    lastColoredDay: null,    // YYYY-MM-DD of the last completed day
    daysColored: 0,          // distinct days a coloring was finished
    hardCompleted: 0,
    uniqueSubjects: 0,
    subjects: {},            // subject(lowercased) -> count, for uniqueSubjects + favourites
    badges: [],              // earned badge ids
    today: { day: null, generated: 0, completed: 0 }, // per-local-day counters
  };
}

export function getProgress() {
  let p;
  try {
    p = JSON.parse(localStorage.getItem(KEY)) || fresh();
  } catch {
    p = fresh();
  }
  // Roll the per-day bucket forward if the calendar day changed.
  const tk = todayKey();
  if (!p.today || p.today.day !== tk) {
    p.today = { day: tk, generated: 0, completed: 0 };
  }
  return p;
}

function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore quota/private-mode */ }
}

// Call when a generation is requested (drives the parent-facing daily counter).
export function recordGeneration() {
  const p = getProgress();
  p.totalGenerated++;
  p.today.generated++;
  save(p);
  return p;
}

// Call when a coloring is finished. Returns { progress, newBadges } so the
// completion screen can reveal freshly-earned stickers.
export function recordCompletion({ subject, difficulty } = {}) {
  const p = getProgress();
  const tk = todayKey();

  p.totalCompleted++;
  p.today.completed++;

  // Streak / days-colored: only advance once per distinct local day.
  if (p.lastColoredDay !== tk) {
    const gap = p.lastColoredDay ? dayDiff(p.lastColoredDay, tk) : null;
    if (gap === 1) p.streak += 1;          // consecutive day
    else p.streak = 1;                     // first ever, or streak broken
    p.lastColoredDay = tk;
    p.daysColored += 1;
    p.longestStreak = Math.max(p.longestStreak, p.streak);
  }

  if (difficulty === 'hard' || difficulty === 'extreme') p.hardCompleted++;

  const subj = (subject || '').trim().toLowerCase();
  if (subj && subj !== '?') {
    p.subjects[subj] = (p.subjects[subj] || 0) + 1;
    p.uniqueSubjects = Object.keys(p.subjects).length;
  }

  // Award any newly-qualified badges.
  const have = new Set(p.badges);
  const newBadges = [];
  for (const b of BADGES) {
    if (!have.has(b.id) && b.test(p)) {
      p.badges.push(b.id);
      newBadges.push(b);
    }
  }

  save(p);
  return { progress: p, newBadges };
}

// Convenience selectors for UI.
export function getEarnedBadges() {
  const have = new Set(getProgress().badges);
  return BADGES.filter((b) => have.has(b.id));
}

export function getDailyCount() {
  return getProgress().today.generated;
}
