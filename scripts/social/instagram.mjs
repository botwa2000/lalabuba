/**
 * Instagram API with Instagram Login (graph.instagram.com) — publishing and
 * long-lived token refresh. Mirrors scripts/ig-publish.mjs, as a module the
 * runner can call, with AI self-disclosure (is_ai_generated, Meta changelog
 * 2026-06-22: set on the media container; for carousels on the parent only).
 */
import { log, redact, registerSecret } from './util.mjs';

const API_VERSION = process.env.IG_API_VERSION || 'v25.0';
const HOST = 'https://graph.instagram.com';

export const IG_LIMITS = { caption: 2200, hashtags: 30, carouselMin: 2, carouselMax: 10 };

async function api(path, { method = 'GET', token, params = {}, versioned = true } = {}) {
  const url = new URL(`${HOST}/${versioned ? `${API_VERSION}/` : ''}${path}`);
  let body;
  if (method === 'GET') for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else body = JSON.stringify(params);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  log(`instagram ${method} /${path} → ${res.status}`);
  if (!res.ok) {
    const e = json.error || {};
    const err = new Error(redact(`Instagram ${res.status} ${method} /${path}: ${e.message || text.slice(0, 300)}` +
      (e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : '')));
    err.status = res.status;
    throw err;
  }
  return json;
}

async function waitForContainer(id, token, label) {
  const delays = [1000, 2000, 3000, 5000, 10000, 15000, 30000, 60000, 60000, 60000];
  for (const ms of delays) {
    const { status_code: status } = await api(id, { token, params: { fields: 'status_code' } });
    if (status === 'FINISHED' || status === 'PUBLISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Container ${label} (${id}) ${status}.`);
    await new Promise((r) => setTimeout(r, ms));
  }
  throw new Error(`Container ${label} (${id}) never reached FINISHED.`);
}

/**
 * Build the container parameters. Pure — the runner's dry-run prints exactly
 * these. Returns { children: [...params], parent: params }.
 */
export function buildContainers({ imageUrls, caption, altText, aiDisclosure }) {
  if (imageUrls.length === 1) {
    return {
      children: [],
      parent: {
        image_url: imageUrls[0], caption,
        ...(altText ? { alt_text: altText } : {}),
        ...(aiDisclosure ? { is_ai_generated: true } : {}),
      },
    };
  }
  return {
    children: imageUrls.map((image_url) => ({ image_url, is_carousel_item: true })),
    parent: { media_type: 'CAROUSEL', caption, ...(aiDisclosure ? { is_ai_generated: true } : {}) },
  };
}

/**
 * Create containers, wait, publish. `onPublishing` fires right before the one
 * irreversible call (media_publish) so the caller can mark the attempt as
 * "uncertain" if anything fails after that point.
 */
export async function publish({ userId, token, containers, onPublishing = () => {} }) {
  registerSecret(token);
  let creationId;
  if (containers.children.length) {
    const ids = [];
    for (const p of containers.children) ids.push((await api(`${userId}/media`, { method: 'POST', token, params: p })).id);
    for (const [i, id] of ids.entries()) await waitForContainer(id, token, `slide ${i + 1}`);
    creationId = (await api(`${userId}/media`, {
      method: 'POST', token, params: { ...containers.parent, children: ids.join(',') },
    })).id;
  } else {
    creationId = (await api(`${userId}/media`, { method: 'POST', token, params: containers.parent })).id;
  }
  await waitForContainer(creationId, token, 'post');
  await onPublishing();
  const { id } = await api(`${userId}/media_publish`, { method: 'POST', token, params: { creation_id: creationId } });
  return { id };
}

/** Long-lived token refresh. Token must be ≥24 h old and unexpired. Returns a new 60-day token. */
export async function refreshToken(token) {
  registerSecret(token);
  const r = await api('refresh_access_token', {
    token, versioned: false, params: { grant_type: 'ig_refresh_token', access_token: token },
  });
  registerSecret(r.access_token);
  return { accessToken: r.access_token, expiresAt: Date.now() + Number(r.expires_in) * 1000 };
}

export async function whoami(userId, token) {
  return api(userId, { token, params: { fields: 'username' } });
}
