// Account management: sign in / register + session persistence.
// Imported by main.js. No framework — vanilla ES module.

import { t } from './i18n.js';
import { getCommunityId } from './community.js';

const BASE = '';  // same origin

// ── Storage keys ────────────────────────────────────────────────────────────
const K_ACCESS  = 'lalabuba-access-token';
const K_REFRESH = 'lalabuba-refresh-token';
const K_EMAIL   = 'lalabuba-account-email';
const K_ACCOUNT = 'lalabuba-account-id';

// ── State ────────────────────────────────────────────────────────────────────
let _session = null; // { accountId, email, accessToken } or null
let _me      = null; // full /api/auth/me response

function loadSession() {
  const accessToken = localStorage.getItem(K_ACCESS);
  const email       = localStorage.getItem(K_EMAIL);
  const accountId   = localStorage.getItem(K_ACCOUNT);
  if (accessToken && email) {
    _session = { accessToken, email, accountId };
    return true;
  }
  return false;
}

function saveSession({ accessToken, refreshToken, email, accountId }) {
  localStorage.setItem(K_ACCESS,  accessToken);
  localStorage.setItem(K_REFRESH, refreshToken);
  localStorage.setItem(K_EMAIL,   email);
  localStorage.setItem(K_ACCOUNT, String(accountId));
  _session = { accessToken, email, accountId };
}

function clearSession() {
  localStorage.removeItem(K_ACCESS);
  localStorage.removeItem(K_REFRESH);
  localStorage.removeItem(K_EMAIL);
  localStorage.removeItem(K_ACCOUNT);
  _session = null;
  _me      = null;
}

export function isSignedIn() { return !!_session; }
export function getSession()  { return _session; }

// ── Token refresh ────────────────────────────────────────────────────────────
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(K_REFRESH);
  if (!refreshToken) return false;
  try {
    const r = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!r.ok) { clearSession(); return false; }
    const data = await r.json();
    // Rotate tokens in-place, keep email + accountId.
    localStorage.setItem(K_ACCESS,  data.accessToken);
    localStorage.setItem(K_REFRESH, data.refreshToken);
    if (_session) _session.accessToken = data.accessToken;
    return true;
  } catch {
    return false;
  }
}

// Fetch with automatic token refresh on 401.
async function authFetch(url, options = {}) {
  if (!_session) return null;
  const go = (token) => fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
    },
  });
  let res = await go(_session.accessToken);
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (!ok) { clearSession(); updateSettingsUI(); return null; }
    res = await go(_session.accessToken);
  }
  return res;
}

// ── API calls ────────────────────────────────────────────────────────────────
async function register(email, password) {
  const deviceUuid = getCommunityId();
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, deviceUuid }),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'Registration failed'), { code: data.code });
  saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, email: data.email, accountId: data.accountId });
}

async function login(email, password) {
  const deviceUuid = getCommunityId();
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, deviceUuid }),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'Login failed'), { code: data.code });
  saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, email: data.email, accountId: data.accountId });
  return data.profile;
}

async function logout() {
  const refreshToken = localStorage.getItem(K_REFRESH);
  if (refreshToken) {
    await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  clearSession();
}

async function fetchMe() {
  const r = await authFetch(`${BASE}/api/auth/me`);
  if (!r) return null;
  if (!r.ok) return null;
  _me = await r.json();
  return _me;
}

// ── Modal DOM ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function getAvatarEmoji(idx) {
  const AVATARS = ['🐉','🐧','🐻','🦄','🐯','🦊','🐰','🐬','🦅','🐺','🐼','🐨','🐆','🦉','🦜','🐹','🦔','🦦','🐿️','🦘'];
  return AVATARS[idx] || '🎨';
}

function getCurrentNickname() {
  return localStorage.getItem('lalabuba-nickname') || null;
}

function getCurrentAvatarIndex() {
  const v = localStorage.getItem('lalabuba-avatar-index');
  return v !== null ? parseInt(v) : 0;
}

// ── Settings menu integration ─────────────────────────────────────────────
export function updateSettingsUI() {
  const row = $('account-settings-row');
  if (!row) return;
  if (_session) {
    const nickname = getCurrentNickname();
    const avatarIdx = getCurrentAvatarIndex();
    row.innerHTML = `
      <div class="settings-account-row" id="account-open-btn" role="button" tabindex="0" aria-label="Account settings">
        <span class="settings-account-avatar">${getAvatarEmoji(avatarIdx)}</span>
        <span class="settings-account-info">
          <span class="settings-account-name">${nickname || _session.email.split('@')[0]}</span>
          <span class="settings-account-status" data-i18n="accountSignedInStatus">✓ Progress saved</span>
        </span>
        <span class="settings-account-arrow">›</span>
      </div>
    `;
    $('account-open-btn').addEventListener('click', openModal);
    $('account-open-btn').addEventListener('keydown', (e) => { if (e.key === 'Enter') openModal(); });
  } else {
    row.innerHTML = `
      <div class="settings-account-row" id="account-open-btn" role="button" tabindex="0" aria-label="${t('accountSaveProgress') || 'Save progress'}">
        <span class="settings-account-avatar">👤</span>
        <span class="settings-account-info">
          <span class="settings-account-name" data-i18n="accountSaveProgress">Save progress</span>
          <span class="settings-account-status" data-i18n="accountSaveProgressSub">Free • Sync across devices</span>
        </span>
        <span class="settings-account-arrow">›</span>
      </div>
    `;
    $('account-open-btn').addEventListener('click', openModal);
    $('account-open-btn').addEventListener('keydown', (e) => { if (e.key === 'Enter') openModal(); });
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────
let _modal = null;
let _activeTab = 'register'; // 'login' | 'register'

function openModal() {
  ensureModal();
  _modal.hidden = false;
  document.body.style.overflow = 'hidden';
  renderModal();
  setTimeout(() => {
    const first = _modal.querySelector('.account-input');
    if (first) first.focus();
  }, 60);
}

function closeModal() {
  if (_modal) _modal.hidden = true;
  document.body.style.overflow = '';
}

function ensureModal() {
  if (_modal) return;
  _modal = $('account-modal');
  if (!_modal) {
    _modal = document.createElement('div');
    _modal.id = 'account-modal';
    _modal.setAttribute('role', 'dialog');
    _modal.setAttribute('aria-modal', 'true');
    _modal.setAttribute('aria-label', 'Account');
    _modal.hidden = true;
    document.body.appendChild(_modal);
  }

  // Close on backdrop click.
  _modal.addEventListener('click', (e) => {
    if (e.target === _modal) closeModal();
  });
  // Close on Escape.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_modal.hidden) closeModal();
  });
}

function renderModal() {
  if (!_modal) return;
  const nickname  = getCurrentNickname();
  const avatarIdx = getCurrentAvatarIndex();
  const avatarEmoji = getAvatarEmoji(avatarIdx);

  if (_session) {
    renderSignedIn(nickname, avatarEmoji);
  } else {
    renderAuthForm(nickname, avatarEmoji);
  }
}

function renderAuthForm(nickname, avatarEmoji) {
  _modal.innerHTML = `
    <div class="account-card">
      <button class="account-close-btn" id="account-close" aria-label="Close">✕</button>

      <div class="account-identity">
        <div class="account-identity-avatar">${avatarEmoji}</div>
        ${nickname ? `<div class="account-identity-name">${nickname}</div>` : ''}
        <div class="account-identity-sub" data-i18n="accountIdentitySub">Save your coloring adventure across devices! 🎨</div>
      </div>

      <div class="account-tabs" role="tablist">
        <button class="account-tab ${_activeTab === 'register' ? 'active' : ''}" id="tab-register" role="tab" aria-selected="${_activeTab === 'register'}">
          <span data-i18n="accountCreateTab">Create account</span>
        </button>
        <button class="account-tab ${_activeTab === 'login' ? 'active' : ''}" id="tab-login" role="tab" aria-selected="${_activeTab === 'login'}">
          <span data-i18n="accountSignInTab">Sign in</span>
        </button>
      </div>

      <div class="account-global-error" id="account-global-error"></div>

      <form class="account-form" id="account-form" novalidate>
        <div class="account-field">
          <label class="account-label" for="account-email" data-i18n="accountEmailLabel">Parent's email</label>
          <input class="account-input" type="email" id="account-email" autocomplete="email" placeholder="parent@example.com" required/>
          <div class="account-error-msg" id="account-email-error">⚠ <span data-i18n="accountEmailError">Please enter a valid email.</span></div>
        </div>
        <div class="account-field">
          <label class="account-label" for="account-password" data-i18n="accountPasswordLabel">Password</label>
          <input class="account-input" type="password" id="account-password" autocomplete="${_activeTab === 'register' ? 'new-password' : 'current-password'}" placeholder="${_activeTab === 'register' ? (t('accountPasswordPlaceholder') || '6+ characters') : ''}" required/>
          <div class="account-error-msg" id="account-password-error">⚠ <span data-i18n="accountPasswordError">Password must be at least 6 characters.</span></div>
        </div>
        <button class="account-submit-btn" type="submit" id="account-submit">
          ${_activeTab === 'register' ? (t('accountRegisterBtn') || 'Create account →') : (t('accountSignInBtn') || 'Sign in →')}
        </button>
      </form>
    </div>
  `;

  $('account-close').addEventListener('click', closeModal);
  $('tab-register').addEventListener('click', () => { _activeTab = 'register'; renderModal(); });
  $('tab-login').addEventListener('click',    () => { _activeTab = 'login';    renderModal(); });
  $('account-form').addEventListener('submit', handleFormSubmit);
}

function renderSignedIn(nickname, avatarEmoji) {
  const devices = _me?.devices || [];
  const myUuid  = getCommunityId();

  const devicesHtml = devices.length > 0 ? `
    <ul class="account-devices-list">
      ${devices.map(d => `
        <li class="account-device-item">
          <span class="account-device-avatar">${getAvatarEmoji(d.avatarIndex || 0)}</span>
          <span class="account-device-info">
            <span class="account-device-nick">${d.nickname || '—'}</span>
            <span class="account-device-streak">🎨 ${d.totalCompleted || 0} · 🔥 ${d.currentStreak || 0} days</span>
          </span>
          ${d.deviceUuid === myUuid ? '<span class="account-device-current">this device</span>' : ''}
        </li>
      `).join('')}
    </ul>
  ` : '';

  _modal.innerHTML = `
    <div class="account-card">
      <button class="account-close-btn" id="account-close" aria-label="Close">✕</button>

      <div class="account-identity">
        <div class="account-identity-avatar">${avatarEmoji}</div>
        ${nickname ? `<div class="account-identity-name">${nickname}</div>` : ''}
        <div class="account-identity-sub account-success-banner">✓ <span data-i18n="accountProgressSaved">Your adventure is saved!</span> 🎉</div>
      </div>

      <div class="account-signed-in">
        <div class="account-email-row">
          <span class="account-email-label" data-i18n="accountEmailRowLabel">Account:</span>
          <span class="account-email-value">${_session.email}</span>
        </div>
        ${devicesHtml}
        <button class="account-signout-btn" id="account-signout" data-i18n="accountSignOutBtn">Sign out</button>
      </div>
    </div>
  `;

  $('account-close').addEventListener('click', closeModal);
  $('account-signout').addEventListener('click', handleSignOut);
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const emailEl    = $('account-email');
  const passwordEl = $('account-password');
  const errorEl    = $('account-global-error');
  const btn        = $('account-submit');

  // Clear errors.
  [$('account-email-error'), $('account-password-error')].forEach(el => el.classList.remove('visible'));
  [emailEl, passwordEl].forEach(el => el.classList.remove('error'));
  errorEl.classList.remove('visible');

  const email    = emailEl.value.trim();
  const password = passwordEl.value;

  let valid = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailEl.classList.add('error');
    $('account-email-error').classList.add('visible');
    valid = false;
  }
  if (_activeTab === 'register' && password.length < 6) {
    passwordEl.classList.add('error');
    $('account-password-error').classList.add('visible');
    valid = false;
  }
  if (!valid) return;

  btn.disabled = true;
  btn.innerHTML = `<span class="account-spinner"></span>${_activeTab === 'register' ? (t('accountCreating') || 'Creating…') : (t('accountSigningIn') || 'Signing in…')}`;

  try {
    if (_activeTab === 'register') {
      await register(email, password);
    } else {
      await login(email, password);
    }
    // Fetch full profile.
    await fetchMe();
    updateSettingsUI();
    renderModal(); // re-render as signed-in view
  } catch (err) {
    let msg = err.message;
    if (err.code === 'EMAIL_TAKEN')      msg = t('accountEmailTaken')    || 'That email is already registered. Try signing in instead.';
    if (err.code === 'BAD_CREDENTIALS')  msg = t('accountWrongPassword') || 'Wrong email or password. Please try again.';
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
    btn.disabled = false;
    btn.textContent = _activeTab === 'register' ? (t('accountRegisterBtn') || 'Create account →') : (t('accountSignInBtn') || 'Sign in →');
  }
}

async function handleSignOut() {
  const btn = $('account-signout');
  if (btn) { btn.disabled = true; btn.textContent = t('accountSigningOut') || 'Signing out…'; }
  await logout();
  updateSettingsUI();
  closeModal();
}

// ── Init ─────────────────────────────────────────────────────────────────────
export async function initAccount() {
  loadSession();
  updateSettingsUI();

  // Silently try to refresh token and load profile on boot.
  if (_session) {
    const ok = await refreshAccessToken();
    if (ok) {
      fetchMe().then(() => updateSettingsUI()).catch(() => {});
    } else {
      clearSession();
      updateSettingsUI();
    }
  }
}

export { openModal as openAccountModal };

// Auto-init: ES module scripts are deferred so DOM is ready.
initAccount();
