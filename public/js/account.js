// Account management: passwordless OTP sign-in + child profile selector.
// Imported by main.js. No framework — vanilla ES module.

import { t } from './i18n.js';
import { getCommunityId } from './community.js';

const BASE = '';

// ── Storage keys ─────────────────────────────────────────────────────────────
const K_ACCESS       = 'lalabuba-access-token';
const K_REFRESH      = 'lalabuba-refresh-token';
const K_EMAIL        = 'lalabuba-account-email';
const K_ACCOUNT      = 'lalabuba-account-id';
const K_CHILD        = 'lalabuba-active-child-id';

// ── State ─────────────────────────────────────────────────────────────────────
let _session  = null; // { accountId, email, accessToken } or null
let _me       = null; // full /api/auth/me response
let _children = [];   // child profiles for this account

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
  // Signal community.js to load the cross-device aggregate for this account.
  window.dispatchEvent(new CustomEvent('lalabuba:login'));
}

function clearSession() {
  localStorage.removeItem(K_ACCESS);
  localStorage.removeItem(K_REFRESH);
  localStorage.removeItem(K_EMAIL);
  localStorage.removeItem(K_ACCOUNT);
  _session = null;
  _me      = null;
  _children = [];
}

export function isSignedIn()   { return !!_session; }
export function getSession()   { return _session; }
export function getActiveChildId() { return localStorage.getItem(K_CHILD); }

// ── Token refresh ─────────────────────────────────────────────────────────────
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
    localStorage.setItem(K_ACCESS,  data.accessToken);
    localStorage.setItem(K_REFRESH, data.refreshToken);
    if (_session) _session.accessToken = data.accessToken;
    return true;
  } catch {
    return false;
  }
}

export async function authFetch(url, options = {}) {
  if (!_session) return null;
  const go = (token) => fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` },
  });
  let res = await go(_session.accessToken);
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (!ok) { clearSession(); updateSettingsUI(); return null; }
    res = await go(_session.accessToken);
  }
  return res;
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function sendOtp(emailAddr, lang) {
  const r = await fetch(`${BASE}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailAddr, lang }),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'Failed to send code'), { code: data.code });
  return data;
}

async function verifyOtp(emailAddr, code) {
  const deviceUuid = getCommunityId();
  const r = await fetch(`${BASE}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailAddr, code, deviceUuid }),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'Invalid code'), { code: data.code, attemptsLeft: data.attemptsLeft });
  return data;
}

async function resendOtp(emailAddr, lang) {
  const r = await fetch(`${BASE}/api/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailAddr, lang }),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'Failed to resend code'), { code: data.code });
  return data;
}

async function doLogout() {
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
  if (!r || !r.ok) return null;
  _me = await r.json();
  return _me;
}

async function fetchChildren() {
  const r = await authFetch(`${BASE}/api/auth/children`);
  if (!r || !r.ok) return [];
  const data = await r.json();
  _children = data.children || [];
  return _children;
}

async function addChild(nickname, avatarIndex, ageGroup) {
  const r = await authFetch(`${BASE}/api/auth/children`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, avatarIndex, ageGroup }),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'Failed to add child'), { code: data.code });
  return data.child;
}

async function deleteChild(childId) {
  await authFetch(`${BASE}/api/auth/children/${childId}`, { method: 'DELETE' });
}

// ── Modal DOM ─────────────────────────────────────────────────────────────────
const $id = (id) => document.getElementById(id);

const AVATARS = ['🐉','🐧','🐻','🦄','🐯','🦊','🐰','🐬','🦅','🐺','🐼','🐨','🐆','🦉','🦜','🐹','🦔','🦦','🐿️','🦘'];
function getAvatarEmoji(idx) { return AVATARS[idx % AVATARS.length] || '🎨'; }

function getCurrentNickname()    { return localStorage.getItem('lalabuba-nickname') || null; }
function getCurrentAvatarIndex() {
  const v = localStorage.getItem('lalabuba-avatar-index');
  return v !== null ? parseInt(v, 10) : 0;
}

// ── Settings row ─────────────────────────────────────────────────────────────
export function updateSettingsUI() {
  const row = $id('account-settings-row');
  if (!row) return;
  const activeChildId = getActiveChildId();
  const activeChild   = _children.find(c => String(c.id) === activeChildId);
  const avatarEmoji   = activeChild ? getAvatarEmoji(activeChild.avatar_index)
                                    : getAvatarEmoji(getCurrentAvatarIndex());
  const name = activeChild ? activeChild.nickname
                           : (_session ? getCurrentNickname() || _session.email.split('@')[0] : null);

  if (_session) {
    row.innerHTML = `
      <div class="settings-account-row" id="account-open-btn" role="button" tabindex="0" aria-label="Account settings">
        <span class="settings-account-avatar">${avatarEmoji}</span>
        <span class="settings-account-info">
          <span class="settings-account-name">${name || _session.email.split('@')[0]}</span>
          <span class="settings-account-status" data-i18n="accountSignedInStatus">✓ Progress saved</span>
        </span>
        <span class="settings-account-arrow">›</span>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div class="settings-account-row" id="account-open-btn" role="button" tabindex="0">
        <span class="settings-account-avatar">👤</span>
        <span class="settings-account-info">
          <span class="settings-account-name" data-i18n="accountSaveProgress">Save progress</span>
          <span class="settings-account-status" data-i18n="accountSaveProgressSub">Free · Sync across devices</span>
        </span>
        <span class="settings-account-arrow">›</span>
      </div>
    `;
  }
  $id('account-open-btn')?.addEventListener('click',   openModal);
  $id('account-open-btn')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') openModal(); });
}

// ── Modal ─────────────────────────────────────────────────────────────────────
let _modal     = null;
let _pendingEmail = ''; // email waiting for OTP confirmation
let _otpCooldownTimer = null;

function openModal() {
  ensureModal();
  _modal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (_session) {
    renderSignedIn();
  } else {
    renderEmailStep();
  }
  setTimeout(() => {
    const first = _modal.querySelector('.account-input:not([disabled])');
    if (first) first.focus();
  }, 60);
}

export function openAccountModal() { openModal(); }

function closeModal() {
  if (_modal) _modal.hidden = true;
  document.body.style.overflow = '';
  _pendingEmail = '';
  clearOtpCooldown();
}

function ensureModal() {
  if (_modal) return;
  _modal = $id('account-modal');
  if (!_modal) {
    _modal = document.createElement('div');
    _modal.id = 'account-modal';
    _modal.setAttribute('role', 'dialog');
    _modal.setAttribute('aria-modal', 'true');
    _modal.setAttribute('aria-label', 'Account');
    _modal.hidden = true;
    document.body.appendChild(_modal);
  }
  _modal.addEventListener('click', (e) => { if (e.target === _modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !_modal.hidden) closeModal(); });
}

// ── Step 1: email entry ───────────────────────────────────────────────────────
function renderEmailStep(prefill = '') {
  const avatarEmoji = getAvatarEmoji(getCurrentAvatarIndex());
  _modal.innerHTML = `
    <div class="account-card">
      <button class="account-close-btn" id="account-close" aria-label="Close">✕</button>
      <div class="account-identity">
        <div class="account-identity-avatar">${avatarEmoji}</div>
        <div class="account-identity-sub">${t('accountIdentitySub') || 'Save your coloring adventure! 🎨'}</div>
      </div>
      <div class="account-global-error" id="account-global-error"></div>
      <form class="account-form" id="account-form" novalidate>
        <div class="account-field">
          <label class="account-label" for="account-email">${t('accountEmailLabel') || "Parent's email"}</label>
          <input class="account-input" type="email" id="account-email" autocomplete="email"
                 placeholder="parent@example.com" value="${escHtml(prefill)}" required/>
          <div class="account-error-msg" id="account-email-error">⚠ ${t('accountEmailError') || 'Please enter a valid email.'}</div>
        </div>
        <button class="account-submit-btn" type="submit" id="account-submit">
          ${t('accountContinueBtn') || 'Continue →'}
        </button>
      </form>
      <p class="account-hint">${t('accountOtpHint') || "We'll send you a 6-digit code. No password needed."}</p>
    </div>
  `;
  $id('account-close').addEventListener('click', closeModal);
  $id('account-form').addEventListener('submit', handleEmailSubmit);
}

async function handleEmailSubmit(e) {
  e.preventDefault();
  const emailEl  = $id('account-email');
  const errorEl  = $id('account-global-error');
  const emailErr = $id('account-email-error');
  const btn      = $id('account-submit');

  emailErr.classList.remove('visible');
  emailEl.classList.remove('error');
  errorEl.classList.remove('visible');

  const emailVal = emailEl.value.trim();
  if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    emailEl.classList.add('error');
    emailErr.classList.add('visible');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="account-spinner"></span>${t('accountSendingCode') || 'Sending code…'}`;

  const lang = document.documentElement.lang?.split('-')[0] || 'en';

  try {
    await sendOtp(emailVal, lang);
    _pendingEmail = emailVal;
    renderOtpStep(emailVal);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = t('accountContinueBtn') || 'Continue →';
    errorEl.textContent = err.message;
    errorEl.classList.add('visible');
  }
}

// ── Step 2: OTP entry ─────────────────────────────────────────────────────────
function renderOtpStep(emailAddr, errorMsg = '') {
  _modal.innerHTML = `
    <div class="account-card">
      <button class="account-close-btn" id="account-close" aria-label="Close">✕</button>
      <div class="account-identity">
        <div class="account-identity-sub">📨 ${t('accountOtpSent') || 'Code sent to'} <strong>${escHtml(emailAddr)}</strong></div>
      </div>
      <div class="account-global-error ${errorMsg ? 'visible' : ''}" id="account-global-error">${escHtml(errorMsg)}</div>
      <form class="account-form" id="otp-form" novalidate>
        <div class="account-field">
          <label class="account-label">${t('accountOtpLabel') || 'Enter 6-digit code'}</label>
          <div class="otp-inputs" id="otp-inputs" role="group" aria-label="Verification code">
            ${[0,1,2,3,4,5].map(i => `<input class="otp-digit" type="text" inputmode="numeric"
              pattern="[0-9]" maxlength="1" id="otp-${i}" aria-label="Digit ${i+1}"/>`).join('')}
          </div>
        </div>
        <button class="account-submit-btn" type="submit" id="otp-submit" disabled>
          ${t('accountVerifyBtn') || 'Verify code →'}
        </button>
      </form>
      <div class="account-resend-row">
        <button class="account-link-btn" id="otp-resend" disabled>
          <span id="otp-resend-label">${t('accountResendCode') || 'Resend code'}</span>
        </button>
        <span class="account-hint-sep">·</span>
        <button class="account-link-btn" id="otp-change-email">${t('accountChangeEmail') || 'Change email'}</button>
      </div>
    </div>
  `;
  $id('account-close').addEventListener('click', closeModal);
  $id('otp-form').addEventListener('submit',   handleOtpSubmit);
  $id('otp-change-email').addEventListener('click', () => renderEmailStep(_pendingEmail));
  $id('otp-resend').addEventListener('click',  handleResend);
  wireOtpInputs();
  startResendCooldown(60);
  $id('otp-0')?.focus();
}

function wireOtpInputs() {
  const inputs = Array.from({ length: 6 }, (_, i) => $id(`otp-${i}`));
  const submitBtn = $id('otp-submit');

  const getFullCode = () => inputs.map(el => el.value).join('');
  const checkFull   = () => {
    const full = getFullCode().length === 6;
    if (submitBtn) submitBtn.disabled = !full;
  };

  inputs.forEach((input, i) => {
    input.addEventListener('input', (e) => {
      // Allow paste into any cell
      const val = e.target.value.replace(/\D/g, '');
      if (val.length > 1) {
        // Distribute pasted digits across cells
        [...val].forEach((d, j) => { if (inputs[i + j]) inputs[i + j].value = d; });
        const nextFocus = Math.min(i + val.length, 5);
        inputs[nextFocus]?.focus();
        e.target.value = val[0] || '';
        checkFull(); return;
      }
      e.target.value = val;
      if (val && i < 5) inputs[i + 1].focus();
      checkFull();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        inputs[i - 1].focus();
        inputs[i - 1].value = '';
        checkFull();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
      [...pasted].forEach((d, j) => { if (inputs[j]) inputs[j].value = d; });
      inputs[Math.min(pasted.length, 5)]?.focus();
      checkFull();
    });
  });
}

async function handleOtpSubmit(e) {
  e.preventDefault();
  const inputs = Array.from({ length: 6 }, (_, i) => $id(`otp-${i}`));
  const code   = inputs.map(el => el.value).join('');
  const btn    = $id('otp-submit');
  const errorEl = $id('account-global-error');

  if (code.length !== 6) return;
  btn.disabled = true;
  btn.innerHTML = `<span class="account-spinner"></span>${t('accountVerifying') || 'Verifying…'}`;
  errorEl.classList.remove('visible');

  try {
    const data = await verifyOtp(_pendingEmail, code);
    saveSession({
      accessToken:  data.accessToken,
      refreshToken: data.refreshToken,
      email:        data.email,
      accountId:    data.accountId,
    });
    await Promise.all([fetchMe(), fetchChildren()]);
    updateSettingsUI();
    if (_children.length === 0) {
      renderAddChildPrompt(); // first-time setup: add a child profile
    } else {
      renderChildSelector();  // pick who's coloring today
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = t('accountVerifyBtn') || 'Verify code →';
    let msg = err.message;
    if (err.attemptsLeft !== undefined) msg += ` (${err.attemptsLeft} ${t('accountAttemptsLeft') || 'attempts left'})`;
    if (err.code === 'MAX_ATTEMPTS') {
      renderOtpStep(_pendingEmail, t('accountMaxAttempts') || 'Too many attempts. Please request a new code.');
      return;
    }
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
    inputs.forEach(el => { el.value = ''; });
    $id('otp-0')?.focus();
  }
}

async function handleResend() {
  const btn   = $id('otp-resend');
  const label = $id('otp-resend-label');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  if (label) label.textContent = t('accountSendingCode') || 'Sending…';
  const lang = document.documentElement.lang?.split('-')[0] || 'en';
  try {
    const data = await resendOtp(_pendingEmail, lang);
    startResendCooldown(data.cooldownSeconds || 60);
    $id('account-global-error')?.classList.remove('visible');
  } catch (err) {
    if (label) label.textContent = t('accountResendCode') || 'Resend code';
    btn.disabled = false;
    const errorEl = $id('account-global-error');
    if (errorEl) { errorEl.textContent = err.message; errorEl.classList.add('visible'); }
  }
}

function startResendCooldown(seconds) {
  clearOtpCooldown();
  const btn   = $id('otp-resend');
  const label = $id('otp-resend-label');
  if (!btn || !label) return;
  let remaining = seconds;
  const update = () => {
    if (!$id('otp-resend')) { clearOtpCooldown(); return; }
    if (remaining <= 0) {
      btn.disabled = false;
      label.textContent = t('accountResendCode') || 'Resend code';
    } else {
      btn.disabled = true;
      label.textContent = `${t('accountResendIn') || 'Resend in'} ${remaining}s`;
      remaining--;
      _otpCooldownTimer = setTimeout(update, 1000);
    }
  };
  update();
}

function clearOtpCooldown() {
  if (_otpCooldownTimer) { clearTimeout(_otpCooldownTimer); _otpCooldownTimer = null; }
}

// ── Child selector screen ─────────────────────────────────────────────────────
function renderChildSelector(isDismissible = true) {
  const cards = _children.map(c => `
    <button class="child-card ${String(c.id) === getActiveChildId() ? 'active' : ''}"
            data-id="${c.id}" aria-pressed="${String(c.id) === getActiveChildId()}">
      <span class="child-card-avatar">${getAvatarEmoji(c.avatar_index)}</span>
      <span class="child-card-name">${escHtml(c.nickname)}</span>
    </button>
  `).join('');

  _modal.innerHTML = `
    <div class="account-card">
      ${isDismissible ? '<button class="account-close-btn" id="account-close" aria-label="Close">✕</button>' : ''}
      <div class="account-identity">
        <div class="account-identity-sub">${t('accountWhoIsColoring') || "Who's coloring today? 🖍️"}</div>
      </div>
      <div class="child-grid" id="child-grid">
        ${cards}
        <button class="child-card child-add-btn" id="child-add-btn">
          <span class="child-card-avatar">➕</span>
          <span class="child-card-name">${t('accountAddChild') || 'Add'}</span>
        </button>
      </div>
      <div class="account-signed-in-footer">
        <button class="account-link-btn" id="account-im-parent" style="font-size:.8rem">
          ${t('accountImParent') || "I'm the parent"}
        </button>
        <span class="account-email-value" style="margin-left:auto;text-align:right">${escHtml(_session.email)}</span>
        <button class="account-link-btn" id="account-signout" style="color:#ef4444;margin-left:8px">${t('accountSignOutBtn') || 'Sign out'}</button>
      </div>
    </div>
  `;
  if (isDismissible) $id('account-close')?.addEventListener('click', closeModal);
  $id('account-signout').addEventListener('click', handleSignOut);
  $id('account-im-parent').addEventListener('click', () => {
    localStorage.removeItem(K_CHILD);
    updateSettingsUI();
    closeModal();
  });
  $id('child-add-btn').addEventListener('click', () => renderAddChildPrompt(false));
  $id('child-grid').querySelectorAll('.child-card[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      localStorage.setItem(K_CHILD, id);
      updateSettingsUI();
      closeModal();
    });
  });
}

// Called from coloring mode (main.js) to auto-show selector if needed
export function maybeShowChildSelector() {
  if (!_session || _children.length === 0) return;
  if (getActiveChildId()) return; // already selected
  ensureModal();
  _modal.hidden = false;
  document.body.style.overflow = 'hidden';
  renderChildSelector(false); // non-dismissible: must pick or tap "I'm the parent"
}

// ── Add child screen ──────────────────────────────────────────────────────────
function renderAddChildPrompt(isFirst = false) {
  let pickedAvatar = Math.floor(Math.random() * AVATARS.length);
  const isFirstTime = isFirst || _children.length === 0;

  const render = () => {
    _modal.innerHTML = `
      <div class="account-card">
        <button class="account-close-btn" id="account-close" aria-label="Close">✕</button>
        <div class="account-identity">
          <div class="account-identity-sub">${t('accountAddChildTitle') || 'Add a child profile 🧒'}</div>
        </div>
        <div class="account-global-error" id="account-global-error"></div>
        <div class="child-avatar-picker" id="child-avatar-picker" role="radiogroup" aria-label="Choose avatar">
          ${AVATARS.map((em, i) => `
            <button class="child-avatar-option ${i === pickedAvatar ? 'selected' : ''}"
                    data-idx="${i}" aria-pressed="${i === pickedAvatar}" type="button">${em}</button>
          `).join('')}
        </div>
        <form class="account-form" id="add-child-form" novalidate>
          <div class="account-field">
            <label class="account-label" for="child-nickname">${t('accountChildName') || "Child's name or nickname"}</label>
            <input class="account-input" type="text" id="child-nickname" maxlength="60"
                   placeholder="${t('accountChildNamePlaceholder') || 'e.g. Emma'}" required/>
            <div class="account-error-msg" id="child-name-error">⚠ ${t('accountChildNameError') || 'Please enter a nickname.'}</div>
          </div>
          <div class="account-field">
            <label class="account-label">${t('accountAgeGroup') || 'Age group'}</label>
            <div class="age-group-pills" id="age-group-pills" role="radiogroup">
              ${['3-5','6-8','9-12','13+'].map(ag => `
                <button class="age-pill" data-age="${ag}" type="button" aria-pressed="false">${ag}</button>
              `).join('')}
            </div>
          </div>
          <button class="account-submit-btn" type="submit" id="add-child-submit">
            ${t('accountSaveChild') || 'Save profile →'}
          </button>
          ${!isFirstTime ? `<button class="account-link-btn" id="back-to-children" type="button">${t('accountBackToChildren') || '← Back'}</button>` : ''}
        </form>
      </div>
    `;
    $id('account-close').addEventListener('click', closeModal);
    if (!isFirstTime) $id('back-to-children')?.addEventListener('click', renderChildSelector);

    $id('child-avatar-picker').querySelectorAll('.child-avatar-option').forEach(btn => {
      btn.addEventListener('click', () => {
        pickedAvatar = parseInt(btn.dataset.idx, 10);
        $id('child-avatar-picker').querySelectorAll('.child-avatar-option').forEach(b => {
          b.classList.toggle('selected', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
      });
    });

    let pickedAge = null;
    $id('age-group-pills').querySelectorAll('.age-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        pickedAge = btn.dataset.age;
        $id('age-group-pills').querySelectorAll('.age-pill').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
      });
    });

    $id('add-child-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nicknameEl = $id('child-nickname');
      const nameErr    = $id('child-name-error');
      const errorEl    = $id('account-global-error');
      const submitBtn  = $id('add-child-submit');
      nameErr.classList.remove('visible');
      errorEl.classList.remove('visible');

      const nickname = nicknameEl.value.trim();
      if (!nickname) { nameErr.classList.add('visible'); nicknameEl.classList.add('error'); return; }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="account-spinner"></span>${t('accountSaving') || 'Saving…'}`;
      try {
        const child = await addChild(nickname, pickedAvatar, pickedAge);
        _children.push(child);
        localStorage.setItem(K_CHILD, String(child.id));
        updateSettingsUI();
        closeModal();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = t('accountSaveChild') || 'Save profile →';
        errorEl.textContent = err.message;
        errorEl.classList.add('visible');
      }
    });
  };
  render();
}

// ── Signed-in view (no children set) ─────────────────────────────────────────
function renderSignedIn() {
  if (_children.length === 0) {
    renderAddChildPrompt(true);
  } else {
    renderChildSelector();
  }
}

async function handleSignOut() {
  const btn = $id('account-signout');
  if (btn) { btn.disabled = true; btn.textContent = t('accountSigningOut') || 'Signing out…'; }
  await doLogout();
  localStorage.removeItem(K_CHILD);
  updateSettingsUI();
  closeModal();
  renderEmailStep();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initAccount() {
  loadSession();
  updateSettingsUI();
  if (_session) {
    const ok = await refreshAccessToken();
    if (ok) {
      await Promise.all([fetchMe(), fetchChildren()]).catch(() => {});
      updateSettingsUI();
    } else {
      clearSession();
      updateSettingsUI();
    }
  }
  // Auto-open modal if redirected here with ?openAccount=1
  if (new URLSearchParams(window.location.search).get('openAccount') === '1') {
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    setTimeout(openModal, 300);
  }
}

initAccount();
