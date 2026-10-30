// App-level events → the first-party beacon (public/js/t.js, window.lalaTrack).
// Generations are logged server-side by /api/generate-image, so generate events
// are not sent from here. Unknown event names are dropped by the server.
const EVENT_MAP = {
  coloring_completed: 'complete',
  draw_saved: 'save',
  draw_shared: 'share_art',
  print: 'print',
  challenge_created: 'challenge_create',
  gallery_opened: 'gallery_open',
};

export function track(event, props = {}) {
  const name = EVENT_MAP[event];
  if (!name) return;
  // Only small, non-identifying props: never the subject text.
  const safe = {};
  if (typeof props.difficulty === 'string') safe.difficulty = props.difficulty;
  try { window.lalaTrack?.(name, Object.keys(safe).length ? safe : undefined); } catch (_) {}
}
