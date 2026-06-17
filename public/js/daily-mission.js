// daily-mission.js — a rotating "today's mission" that nudges daily return and
// exploration. Web twin of the Flutter daily_mission.dart.
//
// Completion is measured as a DELTA from a baseline snapshot taken when the
// mission is assigned (first read of the day): done once
//   metric(now) - metric(baseline) >= amount
// Only strictly-increasing counters are used (never a Set), so completion is
// detectable regardless of history and survives reloads. Mission text resolves
// via the i18n key `mission<CapId>Text`. Local-only, no network.

import { getProgress } from './progress.js';

const KEY = 'lalabuba-daily-mission-v1';

// Ordered mission catalogue (id, emoji, amount, metric). Mirrors kMissions.
export const MISSIONS = [
  { id: 'colorAny',  emoji: '🎨', amount: 1, metric: (p) => p.totalCompleted },
  { id: 'colorTwo',  emoji: '✌️', amount: 2, metric: (p) => p.totalCompleted },
  { id: 'hard',      emoji: '💪', amount: 1, metric: (p) => p.hardCompleted },
  { id: 'maxColors', emoji: '🌈', amount: 1, metric: (p) => p.maxColorUses },
  { id: 'ownIdea',   emoji: '✍️', amount: 1, metric: (p) => p.freeTextCreations },
  { id: 'share',     emoji: '📤', amount: 1, metric: (p) => p.shares },
  { id: 'save',      emoji: '💾', amount: 1, metric: (p) => p.saves },
  { id: 'daily',     emoji: '📅', amount: 1, metric: (p) => p.dailyWordsCompleted },
];

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function dayOfYear() {
  const n = new Date();
  const start = new Date(n.getFullYear(), 0, 1);
  return Math.floor((n - start) / 86400000);
}

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

function write(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { /* ignore */ }
}

// Returns today's mission state: { def, baseline }. Assigns + snapshots the
// baseline on the first read of a new day (and persists it). The baseline is a
// full progress snapshot so deltas are computed against the day's starting point.
export function getDailyMission() {
  const today = todayKey();
  const progress = getProgress();
  const stored = read();
  if (stored && stored.date === today) {
    const def = MISSIONS.find((m) => m.id === stored.id) || MISSIONS[0];
    return { def, baseline: stored.baseline || progress };
  }
  // Assign deterministically and snapshot the baseline now.
  const def = MISSIONS[dayOfYear() % MISSIONS.length];
  write({ date: today, id: def.id, baseline: progress });
  return { def, baseline: progress };
}

// Progress toward the goal, clamped to [0, amount].
export function missionProgressCount(state, now) {
  const d = state.def.metric(now) - state.def.metric(state.baseline);
  return d < 0 ? 0 : (d > state.def.amount ? state.def.amount : d);
}

export function missionIsDone(state, now) {
  return missionProgressCount(state, now) >= state.def.amount;
}
