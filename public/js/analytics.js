export function track(event, props = {}) {
  try { window.posthog?.capture(event, props); } catch (_) {}
}
