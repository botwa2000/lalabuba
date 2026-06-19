// narrate.js — optional spoken feedback for pre-readers ("read aloud"). OFF by
// default. Uses the browser SpeechSynthesis API and speaks in the app's current
// language; a silent no-op where the API is missing (old WebViews) or the toggle
// is off, so callers never have to guard. Governed by `lalabuba-narrate-v1`.
import { getCurrentLang } from './i18n.js';

const KEY = 'lalabuba-narrate-v1';

// App language code → BCP-47 voice tag (best-effort; browser picks closest voice).
const LANG_TAG = {
  en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', nl: 'nl-NL',
  pl: 'pl-PL', pt: 'pt-PT', ru: 'ru-RU', tr: 'tr-TR', zh: 'zh-CN', hi: 'hi-IN',
};

export function narrateSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}
export function isNarrateOn() { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } }
export function setNarrateOn(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ } }
export function toggleNarrate() { const next = !isNarrateOn(); setNarrateOn(next); return next; }

export function speak(text) {
  if (!isNarrateOn() || !text || !narrateSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = LANG_TAG[getCurrentLang()] || 'en-US';
    u.rate = 0.95;   // a touch slow, clear for young ears
    u.pitch = 1.15;  // friendly, slightly bright
    // Don't let rapid taps queue a backlog of utterances.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
