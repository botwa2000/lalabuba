// progress.js — anonymous, local-only progress store.
//
// This is the foundation the retention loop sits on (DESIGN_SPEC step 2):
//  • masterpiece count, days-colored, streak  → the "pull them back" signals
//  • badges/stickers (grouped collections)    → the reward revealed at completion
//  • crayon-pack unlocks + daily mission       → reasons to keep exploring
//  • daily-create counter (per local day)     → drives the dormant, parent-facing
//                                                cap + "come back tomorrow" — never
//                                                blocks the child harshly.
//
// No network, no identifiers, no third parties. Counters live in localStorage;
// the artworks themselves stay in IndexedDB (gallery.js). Everything degrades
// gracefully if storage is unavailable (private mode, quota) — the loop must
// never break because a counter failed to write.
//
// Kept in lock-step with the Flutter twin (progress_service.dart): same badge
// ids, groups, predicates and tracked events. Never rename an existing badge id
// — it would orphan stickers children already earned.

const KEY = 'lalabuba-progress-v1';

// Sticker collections (meaningful grouping shown in the Rewards album).
export const GROUPS = ['milestones', 'streaks', 'explorer', 'creativity', 'sharing'];

// ── Badge catalogue ──────────────────────────────────────────────────────────
// Each badge: id, emoji (sticker art), group, and a `test(p)` predicate run
// against the progress snapshot AFTER an event is recorded. i18n strings
// (title/desc) resolve at display time via `badge<Id>Title|Desc`.
export const BADGES = [
  // Milestones
  { id: 'first',      emoji: '🌟', group: 'milestones', test: (p) => p.totalCompleted >= 1 },
  { id: 'five',       emoji: '🖐️', group: 'milestones', test: (p) => p.totalCompleted >= 5 },
  { id: 'ten',        emoji: '🔟', group: 'milestones', test: (p) => p.totalCompleted >= 10 },
  { id: 'twentyfive', emoji: '🎨', group: 'milestones', test: (p) => p.totalCompleted >= 25 },
  { id: 'fifty',      emoji: '🏆', group: 'milestones', test: (p) => p.totalCompleted >= 50 },
  { id: 'hundred',    emoji: '💯', group: 'milestones', test: (p) => p.totalCompleted >= 100 },
  // Streaks
  { id: 'streak3',    emoji: '🔥', group: 'streaks', test: (p) => p.streak >= 3 },
  { id: 'streak7',    emoji: '⚡', group: 'streaks', test: (p) => p.streak >= 7 },
  { id: 'streak14',   emoji: '🌠', group: 'streaks', test: (p) => p.streak >= 14 },
  { id: 'streak30',   emoji: '👑', group: 'streaks', test: (p) => p.streak >= 30 },
  // Explorer (variety + themes)
  { id: 'explorer',   emoji: '🧭', group: 'explorer', test: (p) => p.uniqueSubjects >= 10 },
  { id: 'animalPal',  emoji: '🐾', group: 'explorer', test: (p) => p.themesColored.includes('animal') },
  { id: 'onTheMove',  emoji: '🚗', group: 'explorer', test: (p) => p.themesColored.includes('vehicle') },
  { id: 'foodie',     emoji: '🍓', group: 'explorer', test: (p) => p.themesColored.includes('food') },
  { id: 'natureFan',  emoji: '🌳', group: 'explorer', test: (p) => p.themesColored.includes('nature') },
  { id: 'peoplePal',  emoji: '🙂', group: 'explorer', test: (p) => p.themesColored.includes('people') },
  { id: 'fantasyFan', emoji: '🐉', group: 'explorer', test: (p) => p.themesColored.includes('fantasy') },
  // Creativity
  { id: 'rainbow',       emoji: '🌈', group: 'creativity', test: (p) => p.hardCompleted >= 1 },
  { id: 'champion',      emoji: '🥇', group: 'creativity', test: (p) => p.extremeCompleted >= 1 },
  { id: 'maxColors',     emoji: '🎆', group: 'creativity', test: (p) => p.maxColorUses >= 1 },
  { id: 'paletteMaster', emoji: '🎭', group: 'creativity', test: (p) => ['classic','pastel','nature'].every((x) => p.palettesUsed.includes(x)) },
  { id: 'inventor',      emoji: '✍️', group: 'creativity', test: (p) => p.freeTextCreations >= 1 },
  { id: 'penArtist',     emoji: '✏️', group: 'creativity', test: (p) => p.drawPenUses >= 1 },
  // Sharing & saving
  { id: 'saver',       emoji: '💾', group: 'sharing', test: (p) => p.saves >= 1 },
  { id: 'collector',   emoji: '📚', group: 'sharing', test: (p) => p.saves >= 5 },
  { id: 'curator',     emoji: '🖼️', group: 'sharing', test: (p) => p.saves >= 25 },
  { id: 'sharer',      emoji: '📤', group: 'sharing', test: (p) => p.shares >= 1 },
  { id: 'superSharer', emoji: '🎁', group: 'sharing', test: (p) => p.shares >= 5 },
  { id: 'challenger',  emoji: '🎯', group: 'sharing', test: (p) => p.challengesCreated >= 1 },
  { id: 'dailyStar',   emoji: '📅', group: 'sharing', test: (p) => p.dailyWordsCompleted >= 1 },
];

// Keyword → theme classifier for Explorer stickers. Runs on the ENGLISH subject
// (the prompt actually sent to the generator) so it is locale-stable. A subject
// may match more than one theme (e.g. "dragon" → animal + fantasy).
const THEME_KEYWORDS = {
  animal: ['cat','dog','puppy','kitten','lion','tiger','bear','panda','elephant','horse','pony','unicorn','rabbit','bunny','fox','wolf','monkey','giraffe','zebra','penguin','owl','bird','duck','chicken','cow','pig','sheep','frog','turtle','fish','shark','whale','dolphin','octopus','crab','snake','dinosaur','dino','butterfly','bee','ladybug','spider','dragon','animal','deer','koala','hedgehog'],
  vehicle: ['car','truck','bus','train','plane','airplane','jet','rocket','ship','boat','submarine','helicopter','tractor','digger','excavator','bike','bicycle','motorcycle','scooter','ambulance','fire truck','police car','spaceship','vehicle'],
  food: ['cake','cupcake','cookie','candy','ice cream','icecream','pizza','burger','donut','doughnut','fruit','apple','banana','strawberry','watermelon','cherry','lollipop','chocolate','pie','sandwich','popcorn','food','sushi','pancake'],
  nature: ['tree','flower','rose','sunflower','plant','garden','forest','mountain','river','sun','moon','star','rainbow','cloud','leaf','mushroom','cactus','ocean','sea','beach','snowflake','nature','volcano','waterfall','sky'],
  people: ['girl','boy','baby','princess','prince','king','queen','knight','pirate','superhero','hero','astronaut','doctor','nurse','teacher','clown','ballerina','mermaid','fairy','witch','wizard','person','family','friend','people','child'],
  fantasy: ['dragon','unicorn','fairy','mermaid','wizard','witch','castle','magic','monster','robot','alien','ghost','genie','phoenix','elf','troll','fantasy','knight','crown'],
};

export function themesOf(subject) {
  const s = (subject || '').trim().toLowerCase();
  if (!s) return [];
  const hit = [];
  for (const [theme, words] of Object.entries(THEME_KEYWORDS)) {
    if (words.some((w) => s === w || s.includes(w))) hit.push(theme);
  }
  return hit;
}

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
    hardCompleted: 0,        // Hard OR Extreme finished
    extremeCompleted: 0,     // Extreme only
    maxColorUses: 0,         // finished with the Max (99) colour count
    freeTextCreations: 0,    // finished a picture from a typed idea
    drawPenUses: 0,          // used the freehand draw pen
    shares: 0,               // artwork shared
    saves: 0,                // saved (download/IndexedDB) to the journal/device
    challengesCreated: 0,    // challenges created
    dailyWordsCompleted: 0,  // daily-word pictures finished
    uniqueSubjects: 0,
    subjects: {},            // subject(lowercased) -> count, for uniqueSubjects + favourites
    palettesUsed: [],        // distinct palettes used in finished pics
    themesColored: [],       // distinct themes finished
    badges: [],              // earned badge ids
    today: { day: null, generated: 0, completed: 0 }, // per-local-day counters
  };
}

export function getProgress() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY));
  } catch {
    stored = null;
  }
  // Merge over fresh() so progress saved before new fields existed loads with
  // safe defaults instead of undefined → NaN on the first increment.
  const p = stored ? { ...fresh(), ...stored } : fresh();
  if (!Array.isArray(p.palettesUsed)) p.palettesUsed = [];
  if (!Array.isArray(p.themesColored)) p.themesColored = [];
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

// Awards any newly-qualified badges against p (mutates p.badges). Returns the
// freshly-earned badge objects in catalogue order.
function award(p) {
  const have = new Set(p.badges);
  const newBadges = [];
  for (const b of BADGES) {
    if (!have.has(b.id) && b.test(p)) {
      p.badges.push(b.id);
      newBadges.push(b);
    }
  }
  return newBadges;
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
export function recordCompletion({ subject, difficulty, palette, colorCount, isCustom, isDaily } = {}) {
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
  if (difficulty === 'extreme') p.extremeCompleted++;
  if (colorCount === 99) p.maxColorUses++;
  if (isCustom) p.freeTextCreations++;
  if (isDaily) p.dailyWordsCompleted++;

  if (palette && !p.palettesUsed.includes(palette)) p.palettesUsed.push(palette);

  for (const theme of themesOf(subject)) {
    if (!p.themesColored.includes(theme)) p.themesColored.push(theme);
  }

  const subj = (subject || '').trim().toLowerCase();
  if (subj && subj !== '?') {
    p.subjects[subj] = (p.subjects[subj] || 0) + 1;
    p.uniqueSubjects = Object.keys(p.subjects).length;
  }

  const newBadges = award(p);
  save(p);
  return { progress: p, newBadges };
}

// One-shot counter bumps for non-completion events. Each returns
// { progress, newBadges } so the caller can toast freshly-unlocked stickers.
function bump(mutate) {
  const p = getProgress();
  mutate(p);
  const newBadges = award(p);
  save(p);
  return { progress: p, newBadges };
}

export function recordShare()            { return bump((p) => { p.shares++; }); }
export function recordSave()             { return bump((p) => { p.saves++; }); }
export function recordChallengeCreated() { return bump((p) => { p.challengesCreated++; }); }
export function recordDrawPenUse() {
  // The badge only needs the first use; skip churn once already counted.
  const p = getProgress();
  if (p.drawPenUses >= 1) return { progress: p, newBadges: [] };
  return bump((q) => { q.drawPenUses++; });
}

// Convenience selectors for UI.
export function getEarnedBadges() {
  const have = new Set(getProgress().badges);
  return BADGES.filter((b) => have.has(b.id));
}

export function badgesIn(group) {
  return BADGES.filter((b) => b.group === group);
}

export function getDailyCount() {
  return getProgress().today.generated;
}
