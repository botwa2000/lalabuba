/**
 * Social posting — queue.yaml parsing, validation and the selection rule.
 *
 * Pure functions (no I/O, no clock) so the rules are unit-tested in
 * scripts/test-social.mjs and the 7-day dry run uses the exact same code
 * path as the live runner.
 *
 * THE RULES
 *  - Only entries with a valid human `approved:` stamp are ever eligible.
 *    Nothing in this codebase writes queue.yaml.
 *  - At most MAX_POSTS_PER_ACCOUNT_PER_DAY attempts per account per Berlin day
 *    (an attempt counts even if it failed — no same-day retry loops).
 *  - Never the same image twice on a platform; never a repeated title or
 *    destination link on an account.
 *  - Dated entries post only on their date (a missed date is reported, never
 *    posted late). Undated entries post in file order.
 *  - Empty queue → nothing. There is no fallback content.
 */
import YAML from 'yaml';
import { BRANDS, PLATFORMS, MAX_POSTS_PER_ACCOUNT_PER_DAY, accountKey } from './config.mjs';
import { PIN_LIMITS } from './pinterest.mjs';
import { IG_LIMITS } from './instagram.mjs';

export const APPROVAL_RE = /^\d{4}-\d{2}-\d{2} [A-Z]{2,4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED = new Set(['id', 'brand', 'platform', 'image', 'images', 'title', 'description', 'link', 'alt', 'board', 'date', 'approved', 'notes']);

/** Absolute public URL for a queue image reference. */
export function resolveImage(brand, ref) {
  if (/^https:\/\//.test(ref)) return ref;
  if (ref.startsWith('/')) return `${BRANDS[brand].site}${ref}`;
  throw new Error(`image "${ref}" must be an https:// URL or a /path on ${BRANDS[brand].site}`);
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normUrl = (u) => String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

/**
 * Parse + validate. Invalid entries are reported and dropped; they never block
 * valid ones. YAML `date:` values are kept as strings (core schema off for dates).
 */
export function parseQueue(text) {
  const doc = YAML.parse(text, { schema: 'core', customTags: [] }) ?? {};
  const raw = Array.isArray(doc) ? doc : doc.posts ?? [];
  if (!Array.isArray(raw)) return { entries: [], history: [], errors: ['queue.yaml: `posts:` must be a list'] };

  const errors = [];
  const history = parseHistory(Array.isArray(doc) ? [] : doc.history ?? [], errors);
  const entries = [];
  const ids = new Map();
  raw.forEach((e, i) => { if (e?.id) ids.set(e.id, (ids.get(e.id) || 0) + 1); });

  raw.forEach((e, i) => {
    const where = `posts[${i}]${e?.id ? ` (${e.id})` : ''}`;
    const errs = [];
    if (!e || typeof e !== 'object') { errors.push(`${where}: not a mapping`); return; }
    for (const k of Object.keys(e)) if (!ALLOWED.has(k)) errs.push(`unknown field "${k}"`);
    for (const k of Object.keys(e)) if (e[k] != null && typeof e[k] !== 'string' && k !== 'images') errs.push(`"${k}" must be a string (quote it)`);
    if (!e.id) errs.push('missing id');
    else if (ids.get(e.id) > 1) errs.push('duplicate id');
    if (!BRANDS[e.brand]) errs.push(`brand must be one of ${Object.keys(BRANDS).join('/')}`);
    if (!PLATFORMS.includes(e.platform)) errs.push(`platform must be one of ${PLATFORMS.join('/')}`);
    if (!e.title) errs.push('missing title');
    if (!e.description) errs.push('missing description');
    if (e.date != null && !DATE_RE.test(e.date)) errs.push('date must be YYYY-MM-DD');
    if (e.approved != null && e.approved !== '' && !APPROVAL_RE.test(e.approved)) errs.push('approved must look like "2026-10-12 AP"');
    if (e.image && e.images) errs.push('use image OR images, not both');
    if (!e.image && !e.images) errs.push('missing image');

    let imageUrls = [];
    if (BRANDS[e.brand]) {
      try {
        const refs = e.images ? (Array.isArray(e.images) ? e.images : [e.images]) : [e.image];
        imageUrls = refs.map((r) => resolveImage(e.brand, String(r)));
      } catch (err) { errs.push(err.message); }
    }

    if (e.platform === 'pinterest') {
      if (!e.board) errs.push('pinterest needs board');
      if (!e.link) errs.push('pinterest needs link');
      if (e.images) errs.push('pinterest entries take a single image');
      if (e.title && e.title.length > PIN_LIMITS.title) errs.push(`title ${e.title.length} > ${PIN_LIMITS.title} chars`);
      if (e.description && e.description.length > PIN_LIMITS.description) errs.push(`description ${e.description.length} > ${PIN_LIMITS.description} chars`);
      if (e.alt && e.alt.length > PIN_LIMITS.alt_text) errs.push(`alt ${e.alt.length} > ${PIN_LIMITS.alt_text} chars`);
    }
    if (e.platform === 'instagram') {
      if (imageUrls.some((u) => !/\.jpe?g$/i.test(u))) errs.push('instagram accepts JPEG only (.jpg)');
      if (e.images && (imageUrls.length < IG_LIMITS.carouselMin || imageUrls.length > IG_LIMITS.carouselMax)) errs.push('carousel needs 2-10 images');
      if (e.description && e.description.length > IG_LIMITS.caption) errs.push(`caption ${e.description.length} > ${IG_LIMITS.caption} chars`);
      if (e.description && (e.description.match(/#\w/g) || []).length > IG_LIMITS.hashtags) errs.push(`more than ${IG_LIMITS.hashtags} hashtags`);
      if (e.board) errs.push('instagram entries take no board');
    }

    if (errs.length) { errors.push(`${where}: ${errs.join('; ')}`); return; }
    entries.push({
      ...e, order: i, account: accountKey(e.platform, e.brand),
      imageUrls, approvedOk: Boolean(e.approved && APPROVAL_RE.test(e.approved)),
    });
  });
  return { entries, history, errors };
}

/**
 * `history:` — posts made outside this service (by hand, before it existed).
 * They become read-only ledger rows so dedupe and the daily ceiling see them.
 */
function parseHistory(raw, errors) {
  if (!Array.isArray(raw)) { errors.push('queue.yaml: `history:` must be a list'); return []; }
  const rows = [];
  raw.forEach((h, i) => {
    const where = `history[${i}]`;
    if (!h || !BRANDS[h.brand] || !PLATFORMS.includes(h.platform) || !DATE_RE.test(String(h.date || ''))) {
      errors.push(`${where}: needs brand, platform and date (YYYY-MM-DD)`);
      return;
    }
    let imageUrls = [];
    try { imageUrls = h.image ? [resolveImage(h.brand, String(h.image))] : []; } catch (err) { errors.push(`${where}: ${err.message}`); return; }
    rows.push({
      entryId: `history:${h.date}:${i}`, account: accountKey(h.platform, h.brand), platform: h.platform,
      brand: h.brand, date: h.date, status: 'published', title: h.title || null, link: h.link || null,
      imageUrls, history: true,
    });
  });
  return rows;
}

/** Ledger as the selection rule sees it: manual history + this service's own posts. */
export function withHistory(ledger, history) {
  return { ...ledger, posts: [...history, ...ledger.posts] };
}

/** Ledger posts that count (anything except an entry we know never went out). */
const counted = (posts) => posts.filter((p) => p.status !== 'failed');

export function attemptsOn(ledger, account, date) {
  return ledger.posts.filter((p) => p.account === account && p.date === date).length;
}

/** Why this entry may not post (dedupe / already done), or null. */
export function conflict(entry, ledger) {
  const posts = counted(ledger.posts);
  if (posts.some((p) => p.entryId === entry.id)) return 'already posted';
  const imgs = new Set(entry.imageUrls.map(normUrl));
  const p1 = posts.find((p) => p.platform === entry.platform && p.imageUrls.some((u) => imgs.has(normUrl(u))));
  if (p1) return `image already posted on ${entry.platform} (${p1.entryId})`;
  const mine = posts.filter((p) => p.account === entry.account);
  const p2 = mine.find((p) => p.title && norm(p.title) === norm(entry.title));
  if (p2) return `title already used (${p2.entryId})`;
  if (entry.link) {
    const p3 = mine.find((p) => p.link && normUrl(p.link) === normUrl(entry.link));
    if (p3) return `link already used (${p3.entryId})`;
  }
  return null;
}

/**
 * Pick what `account` posts on `date`, or null. Also returns why every other
 * entry for this account was passed over, for the log and the dry run.
 */
export function pickEntry({ entries, ledger, account, date }) {
  const skipped = [];
  if (attemptsOn(ledger, account, date) >= MAX_POSTS_PER_ACCOUNT_PER_DAY) {
    return { entry: null, skipped, capped: true };
  }
  const mine = entries.filter((e) => e.account === account);
  const eligible = [];
  for (const e of mine) {
    const c = conflict(e, ledger);
    if (c === 'already posted') continue;
    if (!e.approvedOk) { skipped.push({ id: e.id, reason: 'not approved' }); continue; }
    if (c) { skipped.push({ id: e.id, reason: c }); continue; }
    if (e.date && e.date > date) { skipped.push({ id: e.id, reason: `scheduled for ${e.date}` }); continue; }
    if (e.date && e.date < date) { skipped.push({ id: e.id, reason: `missed its date ${e.date} — never posted late; re-date it` }); continue; }
    eligible.push(e);
  }
  eligible.sort((a, b) => (Boolean(b.date) - Boolean(a.date)) || a.order - b.order);
  return { entry: eligible[0] || null, skipped };
}

/** The ledger row for an attempt. */
export function ledgerRow(entry, date, status, extra = {}) {
  return {
    entryId: entry.id, account: entry.account, platform: entry.platform, brand: entry.brand,
    date, status, title: entry.title, link: entry.link || null, imageUrls: entry.imageUrls,
    approved: entry.approved, at: new Date().toISOString(), ...extra,
  };
}
