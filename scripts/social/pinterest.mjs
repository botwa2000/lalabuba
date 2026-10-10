/**
 * Pinterest API v5 client — pins, boards, OAuth token exchange/refresh.
 *
 * Verified against pinterest/api-description v5/openapi.yaml (5.28.0):
 *   POST /v5/pins       PinCreate { board_id, title≤100, description≤800,
 *                       link≤2048, alt_text≤500, ai_disclosures{values[]},
 *                       media_source{source_type:'image_url', url} }
 *   POST /v5/oauth/token  Basic(app_id:secret), form-encoded. Refresh returns a
 *                       NEW continuous refresh token (60 d) + access token (30 d).
 */
import { log, redact, registerSecret } from './util.mjs';

const HOST = process.env.PINTEREST_API_HOST || 'https://api.pinterest.com';

export const PIN_LIMITS = { title: 100, description: 800, alt_text: 500, link: 2048 };

/** Surface Pinterest's rate-limit headers in every log line about a call. */
function rateInfo(res) {
  const h = (k) => res.headers.get(k);
  const parts = ['limit', 'remaining', 'reset']
    .map((k) => (h(`x-ratelimit-${k}`) != null ? `${k}=${h(`x-ratelimit-${k}`)}` : null))
    .filter(Boolean);
  return parts.length ? `ratelimit[${parts.join(' ')}]` : 'ratelimit[n/a]';
}

async function call(path, { method = 'GET', token, json, form, basic } = {}) {
  const headers = {};
  let body;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (basic) headers.Authorization = `Basic ${basic}`;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }

  const res = await fetch(`${HOST}${path}`, { method, headers, body });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  log(`pinterest ${method} ${path} → ${res.status} ${rateInfo(res)}`);
  if (!res.ok) {
    const err = new Error(redact(`Pinterest ${res.status} ${method} ${path}: ${data.message || text.slice(0, 300)}` +
      (data.code != null ? ` (code ${data.code})` : '')));
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Build the exact PinCreate body. Pure — used by --dry-run and by the runner. */
export function buildPinBody({ boardId, imageUrl, title, description, link, altText, aiDisclosure }) {
  const body = {
    board_id: String(boardId),
    media_source: { source_type: 'image_url', url: imageUrl },
    title,
    description,
    link,
    alt_text: altText,
  };
  if (aiDisclosure) body.ai_disclosures = { values: ['AI_MODIFIED'] };
  for (const k of Object.keys(body)) if (body[k] == null || body[k] === '') delete body[k];
  return body;
}

export async function createPin(token, body) {
  return call('/v5/pins', { method: 'POST', token, json: body });
}

export async function listBoards(token) {
  const out = [];
  let bookmark;
  do {
    const q = new URLSearchParams({ page_size: '100', ...(bookmark ? { bookmark } : {}) });
    const page = await call(`/v5/boards?${q}`, { token });
    out.push(...(page.items || []));
    bookmark = page.bookmark;
  } while (bookmark);
  return out;
}

/** Board given as numeric id passes through; a name is resolved case-insensitively. */
export async function resolveBoardId(token, board) {
  if (/^\d+$/.test(String(board))) return String(board);
  const boards = await listBoards(token);
  const hit = boards.find((b) => b.name.trim().toLowerCase() === String(board).trim().toLowerCase());
  if (!hit) throw new Error(`Pinterest board "${board}" not found. Boards: ${boards.map((b) => b.name).join(', ')}`);
  return hit.id;
}

function basicAuth(appId, appSecret) {
  registerSecret(appSecret);
  return Buffer.from(`${appId}:${appSecret}`).toString('base64');
}

function normalizeTokenResponse(r) {
  registerSecret(r.access_token);
  registerSecret(r.refresh_token);
  const now = Date.now();
  return {
    accessToken: r.access_token,
    accessExpiresAt: now + Number(r.expires_in) * 1000,
    refreshToken: r.refresh_token || null,
    refreshExpiresAt: r.refresh_token_expires_at
      ? Number(r.refresh_token_expires_at) * 1000
      : r.refresh_token_expires_in ? now + Number(r.refresh_token_expires_in) * 1000 : null,
    scope: r.scope || '',
  };
}

export async function exchangeCode({ appId, appSecret, code, redirectUri }) {
  const r = await call('/v5/oauth/token', {
    method: 'POST', basic: basicAuth(appId, appSecret),
    form: { grant_type: 'authorization_code', code, redirect_uri: redirectUri },
  });
  return normalizeTokenResponse(r);
}

export async function refreshAccessToken({ appId, appSecret, refreshToken }) {
  registerSecret(refreshToken);
  const r = await call('/v5/oauth/token', {
    method: 'POST', basic: basicAuth(appId, appSecret),
    form: { grant_type: 'refresh_token', refresh_token: refreshToken },
  });
  const t = normalizeTokenResponse(r);
  // Continuous refresh returns a new refresh token; if Pinterest ever omits it,
  // the old one remains the one to use.
  if (!t.refreshToken) t.refreshToken = refreshToken;
  return t;
}

export const OAUTH_SCOPES = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'];

export function authorizeUrl({ appId, redirectUri, state }) {
  const q = new URLSearchParams({
    client_id: appId, redirect_uri: redirectUri, response_type: 'code',
    scope: OAUTH_SCOPES.join(','), state,
  });
  return `https://www.pinterest.com/oauth/?${q}`;
}

export async function userAccount(token) {
  return call('/v5/user_account', { token });
}
