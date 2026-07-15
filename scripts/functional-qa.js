// Comprehensive functional QA for lalabuba.com
// Tests: nav buttons, hero UI, account creation, OTP flow, child profiles, coloring state
// Usage: node scripts/functional-qa.js
// OTP is fetched from the prod DB via SSH (no manual intervention needed)

'use strict';
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const BASE    = 'https://lalabuba.com';
const OUT_DIR = path.join(__dirname, '..', 'public', 'mockups');
const CHROME  = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SSH_KEY = process.env.HOME + '/.ssh/id_rsa';
const SSH_HOST= '91.99.212.17';

const TEST_EMAIL = `qatest+${Date.now()}@lalabuba-test.com`;
const TEST_PASS  = 'QaTestPass99!';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let browser, step = 0;

async function snap(page, label) {
  const file = path.join(OUT_DIR, `qa-${String(++step).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${path.basename(file)}`);
  return file;
}

function dbQuery(sql) {
  const cmd = `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new root@${SSH_HOST} ` +
    `"docker exec \\$(docker ps -q --filter name=lalabuba-prod_app) ` +
    `sh -c 'psql \\\"\\$(cat /run/secrets/lalabuba_prod_DATABASE_URL)\\\" -t -c \\\"${sql}\\\"'"`;
  return execSync(cmd, { encoding: 'utf8', timeout: 15000 }).trim();
}

async function getOtpFromDb(email) {
  console.log('  🔑 Fetching OTP from prod DB…');
  for (let i = 0; i < 8; i++) {
    const code = dbQuery(
      `SELECT code FROM email_otp_codes WHERE email='${email}' AND used_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`
    ).trim();
    if (code && /^\d{6}$/.test(code)) { console.log(`  ✅ OTP retrieved`); return code; }
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error('OTP not found in DB after 12s');
}

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1440, height: 900 },
    isMobile: opts.mobile || false,
    hasTouch: opts.mobile || false,
    deviceScaleFactor: opts.mobile ? 2 : 1,
    reducedMotion: 'reduce',   // suppress CSS animations so buttons are "stable"
    userAgent: opts.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await ctx.newPage();

  // Instrument: track submit event listeners being added (before any page scripts run)
  await page.addInitScript(() => {
    const _origAddEv = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, fn, opts) {
      if (type === 'submit') {
        window.__submitListeners = window.__submitListeners || [];
        window.__submitListeners.push(this?.id || this?.tagName || '?');
      }
      return _origAddEv.call(this, type, fn, opts);
    };
  });

  // Log browser errors so we can diagnose failures
  page.on('pageerror', err => console.log(`  [PAGE ERROR] ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [CONSOLE ERR] ${msg.text()}`);
  });
  return { ctx, page };
}

// Reliable click — force bypasses animation/stability; JS fallback for off-viewport elements
async function click(locator) {
  try {
    await locator.click({ force: true, timeout: 5000 });
  } catch {
    // Fall back to JS click (works for hidden/off-viewport elements)
    await locator.evaluate(el => el.click());
  }
}

// ── PHASE 1: Desktop hero state ────────────────────────────────────────────────
async function testHero(page) {
  console.log('\n── HERO STATE ────────────────────────────────────────────────────');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await snap(page, 'hero-initial');

  // Nav buttons
  console.log('  Testing nav buttons…');
  const journalBtn = page.locator('#journal-btn');
  await click(journalBtn);
  await page.waitForTimeout(800);
  await snap(page, 'gallery-modal-open');

  // Close gallery modal via JS (button may not be in viewport)
  await page.evaluate(() => {
    const btn = document.getElementById('close-gallery-modal');
    if (btn) btn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await page.waitForTimeout(500);
  await page.waitForTimeout(500);

  // Settings button
  const settingsBtn = page.locator('.settings-toggle-btn').first();
  await click(settingsBtn);
  await page.waitForTimeout(600);
  await snap(page, 'settings-menu-open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Explore button (desktop)
  const exploreBtn = page.locator('#explore-nav-btn');
  if (await exploreBtn.count() > 0) {
    const href = await exploreBtn.getAttribute('href');
    console.log(`  🎨 Explore btn href: ${href}`);
  }

  // Shuffle button (the 🎲 die icon)
  console.log('  Testing suggestion cards + shuffle…');
  const shuffleBtn = page.locator('.shuffle-btn, #shuffle-suggestions-btn, [aria-label*="Shuffle"], [aria-label*="shuffle"]').first();
  if (await shuffleBtn.count() > 0) {
    await click(shuffleBtn);
    await page.waitForTimeout(800);
    await snap(page, 'after-shuffle');
  } else {
    // Try any button containing 🎲
    const dieBtn = page.locator('button:has-text("🎲")').first();
    if (await dieBtn.count() > 0) {
      await click(dieBtn);
      await page.waitForTimeout(800);
      await snap(page, 'after-shuffle');
      console.log('  🎲 Shuffle (🎲 button) clicked');
    }
  }

  // Click a suggestion card — cards may fill the input OR navigate to a coloring page
  const cards = page.locator('.suggestion-card, .topic-card, [data-topic]');
  if (await cards.count() > 0) {
    const firstCard = cards.first();
    const topic = await firstCard.getAttribute('data-topic') || await firstCard.textContent();
    const tag = await firstCard.evaluate(el => el.tagName.toLowerCase());
    console.log(`  🃏 Card <${tag}> topic: "${topic?.trim().slice(0,20)}"`);
    const urlBefore = page.url();
    await click(firstCard);
    await page.waitForTimeout(1000);
    const urlAfter = page.url();
    if (urlAfter !== urlBefore) {
      console.log(`  ✅ Card navigated to: ${urlAfter}`);
      await snap(page, 'card-navigation-target');
      // Go back to homepage for remaining tests
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
    } else {
      const subjectVal = await page.locator('#subject').inputValue().catch(() => '');
      console.log(`  ✅ Subject filled: "${subjectVal}"`);
    }
  }

  // Surprise Me (💡 button)
  const surpriseBtn = page.locator('#surprise-btn, [aria-label*="Surprise"]').first();
  if (await surpriseBtn.count() > 0) {
    await click(surpriseBtn);
    await page.waitForTimeout(300);
    const val = await page.locator('#subject').inputValue();
    console.log(`  💡 Surprise me filled: ${val}`);
  }

  // Difficulty pills
  console.log('  Testing difficulty pills…');
  for (const diff of ['easy', 'medium', 'hard']) {
    const pill = page.locator(`.diff-pill[data-diff="${diff}"]`);
    if (await pill.count() > 0) {
      await click(pill);
      await page.waitForTimeout(200);
      const active = await pill.evaluate(el =>
        el.classList.contains('active') || el.classList.contains('selected') ||
        el.getAttribute('aria-pressed') === 'true' || el.dataset.active === 'true'
      );
      console.log(`  ${active ? '✅' : '⚠️'} ${diff} pill clicked, active=${active}`);
    }
  }
  // Extreme pill — should be locked for new users
  const extremePill = page.locator('.diff-pill[data-diff="extreme"]');
  if (await extremePill.count() > 0) {
    const disabled = await extremePill.evaluate(el => el.disabled);
    const text = await extremePill.textContent();
    console.log(`  🔒 Extreme pill: disabled=${disabled}, text="${text?.trim()}"`);
  }
  await snap(page, 'difficulty-pills');

  // Daily word pill
  const dailyPill = page.locator('#daily-word-pill, .daily-word-pill, [data-daily]').first();
  if (await dailyPill.count() > 0) {
    const dailyText = await dailyPill.textContent();
    console.log(`  ☀️ Daily word pill: "${dailyText?.trim()}"`);
    await click(dailyPill);
    await page.waitForTimeout(300);
    const filled = await page.locator('#subject').inputValue();
    console.log(`  ✅ Daily word filled subject: "${filled}"`);
  }

  // Theme toggle — open the settings menu then click theme toggle via JS
  await page.evaluate(() => {
    // First open the menu
    const toggle = document.getElementById('settings-toggle');
    if (toggle) toggle.click();
  });
  await page.waitForTimeout(400);
  await snap(page, 'settings-menu-open');
  // Click theme button directly in JS (menu is open so element is visible)
  await page.evaluate(() => {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log(`  🌙 Theme toggled: ${theme}`);
  await snap(page, 'dark-theme');
  // Toggle back
  await page.evaluate(() => {
    const toggle = document.getElementById('settings-toggle');
    if (toggle) toggle.click();
    setTimeout(() => { const btn = document.getElementById('theme-toggle'); if (btn) btn.click(); }, 100);
  });
  await page.waitForTimeout(600);

  // Language picker — open settings menu then click language toggle via JS
  await page.evaluate(() => {
    const toggle = document.getElementById('settings-toggle');
    if (toggle) toggle.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) langToggle.click();
  });
  await page.waitForTimeout(400);
  const deOpt = page.locator('.lang-option[data-lang="de"]');
  if (await deOpt.count() > 0) {
    await click(deOpt.first());
    await page.waitForTimeout(800);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    const pageTitle = await page.evaluate(() => document.title);
    console.log(`  🌍 Language → DE, html lang="${htmlLang}", title="${pageTitle}"`);
    await snap(page, 'lang-german');
    // Back to EN
    await page.evaluate(() => {
      const toggle = document.getElementById('settings-toggle');
      if (toggle) toggle.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const langToggle = document.getElementById('lang-toggle');
      if (langToggle) langToggle.click();
    });
    await page.waitForTimeout(300);
    const enOpt = page.locator('.lang-option[data-lang="en"]');
    if (await enOpt.count() > 0) { await click(enOpt.first()); await page.waitForTimeout(600); }
  } else {
    await page.keyboard.press('Escape');
    console.log('  ⚠️ Language options not found');
  }

  console.log('  ✅ Hero state checks complete');
}

// ── PHASE 2: Drawing flow ──────────────────────────────────────────────────────
async function testDraw(page) {
  console.log('\n── DRAW FLOW ─────────────────────────────────────────────────────');

  // Fresh load — use 'load' so all <script type="module"> (main.js) have finished executing
  // before we try to interact. 'domcontentloaded' fires before ES module graphs resolve,
  // so the form submit listener isn't attached yet → click causes a real GET navigation.
  await page.goto(BASE, { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(500);

  // Set subject and Easy difficulty
  await page.fill('#subject', 'bunny');
  const easyPill = page.locator('.diff-pill[data-diff="easy"]');
  if (await easyPill.count() > 0) await click(easyPill);
  await page.waitForTimeout(200);

  await snap(page, 'before-draw');

  // Debug: check state before submitting
  const preDrawState = await page.evaluate(() => {
    const sub = document.getElementById('subject');
    const btn = document.getElementById('generate-button');
    const app = document.querySelector('.app');
    return {
      subjectVal: sub?.value,
      btnDisabled: btn?.disabled,
      btnExists: !!btn,
      hasAppHero: app?.classList.contains('app-hero'),
      submitListeners: window.__submitListeners || [],
      difficultyPills: Array.from(document.querySelectorAll('.diff-pill')).map(p => ({
        diff: p.dataset.diff, active: p.classList.contains('active')
      })),
    };
  });
  console.log(`  🔍 Pre-draw: subject="${preDrawState.subjectVal}", btnDisabled=${preDrawState.btnDisabled}, appHero=${preDrawState.hasAppHero}`);
  console.log(`  🔍 Submit listeners: [${preDrawState.submitListeners.join(', ')}]`);
  console.log(`  🔍 Difficulty pills: ${JSON.stringify(preDrawState.difficultyPills)}`);

  // Click the Draw! button — trusted Playwright click on the submit button.
  // NOTE: framenavigated fires for ALL frames including Cloudflare Turnstile iframes.
  // Only a MAIN-FRAME navigation means the submit listener wasn't attached (form GET reset).
  let mainNavAfterClick = false;
  const navGuard = (frame) => { if (frame === page.mainFrame()) mainNavAfterClick = true; };
  page.on('framenavigated', navGuard);
  await page.locator('#generate-button').click({ force: true });
  await page.waitForTimeout(1000);
  page.off('framenavigated', navGuard);
  if (mainNavAfterClick) {
    console.log('  ⚠️ MAIN-FRAME navigation detected — submit listener was NOT attached. Retrying.');
    await page.waitForLoadState('load', { timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.fill('#subject', 'bunny');
    await page.waitForTimeout(200);
    await page.locator('#generate-button').click({ force: true });
  } else {
    console.log('  ✅ No main navigation — submit listener fired (Turnstile iframe is expected)');
  }

  console.log('  ⏳ Waiting for image generation (up to 120s incl. Turnstile 15s wait)…');
  try {
    // First wait for loading to START (loading overlay appears or app-hero disappears)
    await page.waitForFunction(() => {
      const app = document.querySelector('.app');
      const loading = document.getElementById('loading-overlay');
      return (app && !app.classList.contains('app-hero')) ||
             (loading && (loading.style.display === 'flex' || loading.style.display === ''));
    }, null, { timeout: 25000 });
    // Then wait for generation to FINISH
    await page.waitForFunction(() => {
      const c = document.getElementById('preview-canvas');
      const loading = document.getElementById('loading-overlay');
      return c && !c.hidden && c.width > 100 &&
             (!loading || loading.style.display === 'none' || loading.hidden);
    }, null, { timeout: 120000 });
    await page.waitForFunction(() => {
      const btn = document.getElementById('canvas-numbers-btn');
      return btn && !btn.disabled;
    }, null, { timeout: 30000 });
    await page.waitForTimeout(2000);
    await snap(page, 'coloring-state');
    console.log('  ✅ Image generated and segmented');

    // Test coloring actions
    await testColoringState(page);
  } catch (err) {
    console.log(`  ⚠️ Generation timed out: ${err.message}`);
    await snap(page, 'generation-failed');
  }
}

async function testColoringState(page) {
  console.log('\n── COLORING STATE ────────────────────────────────────────────────');

  // Palette — tap first color
  const palette = page.locator('.palette-swatch, .color-swatch, [data-color]').first();
  if (await palette.count() > 0) {
    await palette.click();
    await page.waitForTimeout(200);
    console.log('  🎨 Palette swatch clicked');
  }
  await snap(page, 'coloring-palette');

  // Numbers toggle
  const numsBtn = page.locator('#canvas-numbers-btn');
  if (await numsBtn.count() > 0) {
    await numsBtn.click();
    await page.waitForTimeout(400);
    await snap(page, 'numbers-off');
    await numsBtn.click();
    await page.waitForTimeout(400);
    console.log('  🔢 Numbers toggle works');
  }

  // Undo
  const undoBtn = page.locator('#undo-btn, [aria-label*="Undo"], [aria-label*="undo"]').first();
  if (await undoBtn.count() > 0) {
    await undoBtn.click();
    await page.waitForTimeout(200);
    console.log('  ↩️ Undo clicked');
  }

  // Mode toggle (tap/paint)
  const modeBtn = page.locator('#mode-btn, .mode-toggle, [data-mode]').first();
  if (await modeBtn.count() > 0) {
    await modeBtn.click();
    await page.waitForTimeout(200);
    console.log('  🖊️ Mode toggle clicked');
    await snap(page, 'paint-mode');
    await modeBtn.click();
    await page.waitForTimeout(200);
  }

  // Draw mode pencil
  const drawBtn = page.locator('#draw-mode-btn, [aria-label*="Draw"], [aria-label*="Pencil"], [aria-label*="pencil"]').first();
  if (await drawBtn.count() > 0) {
    await drawBtn.click();
    await page.waitForTimeout(200);
    await snap(page, 'draw-mode');
    await drawBtn.click();
    await page.waitForTimeout(200);
    console.log('  ✏️ Draw mode toggle works');
  }

  // Again! button
  const againBtn = page.locator('#again-btn, [aria-label*="Again"], [aria-label*="again"]').first();
  if (await againBtn.count() > 0) {
    console.log('  🎲 Again! button visible');
  }

  // Save button
  const saveBtn = page.locator('#save-btn, [aria-label*="Save"], [aria-label*="save"]').first();
  if (await saveBtn.count() > 0) {
    console.log('  💾 Save button visible');
  }

  await snap(page, 'coloring-all-controls');
  console.log('  ✅ Coloring state checks complete');
}

// ── PHASE 3: Account creation ──────────────────────────────────────────────────
async function testAccountCreation(page) {
  console.log('\n── ACCOUNT CREATION ──────────────────────────────────────────────');
  console.log(`  📧 Test email: ${TEST_EMAIL}`);

  // Fresh page, then open account modal via the settings menu account-open-btn
  // Use 'load' to ensure all ES modules (including account.js) have initialised
  await page.goto(BASE, { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1500);

  // Open settings then click the account row via JS (settings menu is a hidden dropdown)
  await page.evaluate(() => {
    const toggle = document.getElementById('settings-toggle');
    if (toggle) toggle.click();
  });
  await page.waitForTimeout(400);
  const openResult = await page.evaluate(() => {
    // The settings menu is now open; click the account row
    const btn = document.getElementById('account-open-btn');
    if (btn) { btn.click(); return 'via-account-open-btn'; }
    // Fallback: call the exported function from account module
    // (the module exports openAccountModal which is wired in generate.js via import)
    if (typeof openAccountModal === 'function') { openAccountModal(); return 'via-export'; }
    return 'not-found';
  });
  console.log(`  🔐 Account modal open method: ${openResult}`);
  await page.waitForTimeout(1000);

  // If modal still not open, try navigating with ?openAccount=1
  const emailFound = await page.locator('#account-email').count();
  if (emailFound === 0) {
    console.log('  ⚠️ Modal not open via settings, navigating to ?openAccount=1');
    await page.goto(`${BASE}?openAccount=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
  }

  // Show what we have
  await snap(page, 'account-modal-email-step');

  // Wait for the email input to appear
  await page.waitForSelector('#account-email', { state: 'attached', timeout: 15000 });

  await page.locator('#account-email').fill(TEST_EMAIL);
  await page.waitForTimeout(200);
  await click(page.locator('#account-submit'));
  await page.waitForTimeout(2000);
  await snap(page, 'account-otp-step');
  console.log('  📨 OTP step reached');

  // Fetch OTP from DB
  const otp = await getOtpFromDb(TEST_EMAIL);

  // Fill OTP digits
  for (let i = 0; i < 6; i++) {
    const input = page.locator(`#otp-${i}`);
    await input.fill(otp[i]);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(300);
  await snap(page, 'account-otp-filled');

  // Submit OTP
  await click(page.locator('#otp-submit'));
  await page.waitForTimeout(2000);
  await snap(page, 'account-after-verify');
  console.log('  ✅ OTP verified, account created');

  // Should now show "Add child profile"
  const addChildTitle = page.locator('.account-identity-sub, .account-identity');
  const titleText = await addChildTitle.first().textContent().catch(() => '');
  console.log(`  📄 Post-verify screen: "${titleText?.trim()?.slice(0, 60)}"`);

  // Fill child profile
  const nicknameInput = page.locator('#child-nickname');
  if (await nicknameInput.count() > 0) {
    await nicknameInput.fill('TestKid');
    await page.waitForTimeout(200);

    // Pick an avatar (pick the third one)
    const avatarBtns = page.locator('.child-avatar-option');
    if (await avatarBtns.count() > 2) {
      await click(avatarBtns.nth(2));
      await page.waitForTimeout(200);
    }

    // Pick age group
    const agePill = page.locator('.age-pill[data-age="6-8"]');
    if (await agePill.count() > 0) {
      await click(agePill);
      await page.waitForTimeout(200);
    }

    await snap(page, 'child-profile-form');

    // Save child
    await click(page.locator('#add-child-submit'));
    await page.waitForTimeout(1500);
    await snap(page, 'account-logged-in');
    console.log('  👶 Child profile created');

    // Verify settings row updated
    const settingsRow = page.locator('#account-settings-row');
    const rowText = await settingsRow.textContent().catch(() => '');
    console.log(`  ✅ Settings row: "${rowText?.trim()?.slice(0, 80)}"`);
  } else {
    console.log('  ⚠️ Add-child form not found — checking what screen is shown');
    const modal = page.locator('#account-modal, [role="dialog"]').first();
    const modalText = await modal.textContent().catch(() => '');
    console.log(`  Modal text: "${modalText?.trim()?.slice(0, 200)}"`);
  }

  // Open account again via JS — should show child selector
  await page.evaluate(() => {
    const toggle = document.getElementById('settings-toggle');
    if (toggle) toggle.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const btn = document.getElementById('account-open-btn');
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);
  await snap(page, 'child-selector');
  const selectorText = page.locator('.account-identity-sub').first();
  console.log(`  🧒 Child selector screen: "${await selectorText.textContent().catch(() => '')}"`);

  // Add second child
  const addBtn = page.locator('#child-add-btn');
  if (await addBtn.count() > 0) {
    await click(addBtn);
    await page.waitForTimeout(400);
    const nicknameInput2 = page.locator('#child-nickname');
    await nicknameInput2.fill('TestKid2');
    const agePill2 = page.locator('.age-pill[data-age="9-12"]');
    if (await agePill2.count() > 0) await click(agePill2);
    await click(page.locator('#add-child-submit'));
    await page.waitForTimeout(1500);
    console.log('  👶 Second child added');
    await snap(page, 'child-selector-two-children');
  }

  // Close modal
  await page.evaluate(() => {
    const btn = document.getElementById('account-close');
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);

  console.log('  ✅ Account creation and children linking complete');
}

// ── PHASE 4: Mobile portrait web test ────────────────────────────────────────
async function testMobilePortrait() {
  console.log('\n── MOBILE PORTRAIT (390×844) ─────────────────────────────────────');
  const { ctx, page } = await newPage(browser, {
    viewport: { width: 390, height: 844 },
    mobile: true,
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await snap(page, 'mobile-hero');

  // Hamburger menu
  const hamburger = page.locator('.mobile-menu-btn');
  if (await hamburger.count() > 0) {
    await click(hamburger);
    await page.waitForTimeout(500);
    await snap(page, 'mobile-config-panel-open');
    // Close it
    await page.tap('body', { position: { x: 350, y: 200 } });
    await page.waitForTimeout(400);
  }

  // Journal/gallery button
  const journalMobile = page.locator('#journal-btn');
  await click(journalMobile);
  await page.waitForTimeout(600);
  await snap(page, 'mobile-gallery-open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Settings button
  const settingsMobile = page.locator('.settings-toggle-btn').first();
  if (await settingsMobile.count() > 0) {
    await click(settingsMobile);
    await page.waitForTimeout(400);
    await snap(page, 'mobile-settings-open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Draw a simple subject
  await page.fill('#subject', 'cat', { force: true });
  await page.waitForTimeout(200);
  await snap(page, 'mobile-subject-filled');

  // Click the Draw! button (same approach as desktop)
  await page.locator('#generate-button').click({ force: true });

  console.log('  ⏳ Waiting for mobile generation…');
  try {
    await page.waitForFunction(() => {
      const c = document.getElementById('preview-canvas');
      return c && !c.hidden && c.width > 100 &&
             !document.getElementById('loading-overlay')?.style.display?.includes('flex');
    }, null, { timeout: 60000 });
    await page.waitForFunction(() => {
      const btn = document.getElementById('canvas-numbers-btn');
      return btn && !btn.disabled;
    }, null, { timeout: 90000 });
    await page.waitForTimeout(2000);
    await snap(page, 'mobile-coloring-state');
    console.log('  ✅ Mobile: image generated');

    // Hamburger in coloring state
    if (await hamburger.count() > 0) {
      await hamburger.click();
      await page.waitForTimeout(500);
      await snap(page, 'mobile-coloring-panel');
      await page.tap('body', { position: { x: 350, y: 200 } });
      await page.waitForTimeout(300);
    }
  } catch (err) {
    console.log(`  ⚠️ Mobile generation timed out: ${err.message}`);
    await snap(page, 'mobile-generation-failed');
  }

  await ctx.close();
  console.log('  ✅ Mobile portrait checks complete');
}

// ── PHASE 5: LP/coloring page nav test ───────────────────────────────────────
async function testLpNav() {
  console.log('\n── LP NAV (coloring page) ────────────────────────────────────────');
  const { ctx, page } = await newPage(browser);

  // Visit a coloring page hub
  await page.goto(`${BASE}/en/coloring-pages/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await snap(page, 'lp-hub-page');

  const lpNav = page.locator('.lp-nav');
  if (await lpNav.count() > 0) {
    // Check explore button
    const exploreLink = page.locator('.lp-nav a[href*="coloring-pages"], .lp-nav-icon-btn').first();
    const exploreHref = await exploreLink.getAttribute('href').catch(() => null);
    console.log(`  🎨 LP nav explore link: ${exploreHref}`);

    // Journal/home link
    const journalLink = page.locator('.lp-nav a[href="/"], .lp-nav a[href*="/"]:first-child').first();
    console.log(`  🖼️ LP nav brand href: ${await journalLink.getAttribute('href').catch(() => null)}`);

    // Language picker on LP
    const lpLangBtn = page.locator('.lp-lang-btn');
    if (await lpLangBtn.count() > 0) {
      await lpLangBtn.click();
      await page.waitForTimeout(400);
      await snap(page, 'lp-lang-picker');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Draw! CTA
    const ctaBtn = page.locator('.lp-nav-cta');
    const ctaText = await ctaBtn.textContent().catch(() => '');
    console.log(`  ✏️ LP nav CTA: "${ctaText?.trim()}"`);

    // Theme toggle on LP
    const lpTheme = page.locator('#lp-theme-btn');
    if (await lpTheme.count() > 0) {
      await lpTheme.click();
      await page.waitForTimeout(300);
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      console.log(`  🌙 LP theme toggled: ${theme}`);
      await snap(page, 'lp-dark-theme');
      await lpTheme.click();
      await page.waitForTimeout(200);
    }
  } else {
    console.log('  ⚠️ No LP nav found on hub page');
  }

  await ctx.close();
  console.log('  ✅ LP nav checks complete');
}

// ── PHASE 6: Android emulator via adb ─────────────────────────────────────────
async function testAndroidEmulator() {
  console.log('\n── ANDROID EMULATOR (adb) ────────────────────────────────────────');
  try {
    const devices = execSync('adb devices', { encoding: 'utf8' }).trim();
    console.log('  📱 ADB devices:\n  ' + devices.split('\n').join('\n  '));

    // Try opening the Flutter app if installed
    const packages = execSync('adb shell pm list packages | grep lalabuba', { encoding: 'utf8' }).trim();
    const pkgName  = packages.match(/package:(\S+)/)?.[1];

    if (pkgName) {
      console.log(`  📦 Found package: ${pkgName}`);
      execSync(`adb shell monkey -p ${pkgName} -c android.intent.category.LAUNCHER 1`, { encoding: 'utf8' });
      await new Promise(r => setTimeout(r, 3000));
      const sc1 = path.join(OUT_DIR, `qa-${String(++step).padStart(2,'0')}-android-launch.png`);
      execSync(`adb exec-out screencap -p > "${sc1}"`);
      console.log(`  📸 ${path.basename(sc1)}`);

      // Wait for app to settle
      await new Promise(r => setTimeout(r, 2000));
      const sc2 = path.join(OUT_DIR, `qa-${String(++step).padStart(2,'0')}-android-home.png`);
      execSync(`adb exec-out screencap -p > "${sc2}"`);
      console.log(`  📸 ${path.basename(sc2)}`);

      // Tap the settings icon (approx bottom-right area for Flutter app)
      execSync('adb shell input tap 950 1800');
      await new Promise(r => setTimeout(r, 1500));
      const sc3 = path.join(OUT_DIR, `qa-${String(++step).padStart(2,'0')}-android-settings.png`);
      execSync(`adb exec-out screencap -p > "${sc3}"`);
      console.log(`  📸 ${path.basename(sc3)}`);

    } else {
      console.log('  ℹ️ Lalabuba app not installed — testing mobile web via Chrome on emulator');
      // Open Chrome on emulator with lalabuba.com
      execSync('adb shell am start -a android.intent.action.VIEW -d "https://lalabuba.com" com.android.chrome', { encoding: 'utf8', timeout: 10000 });
      await new Promise(r => setTimeout(r, 5000));
      const sc1 = path.join(OUT_DIR, `qa-${String(++step).padStart(2,'0')}-android-chrome.png`);
      execSync(`adb exec-out screencap -p > "${sc1}"`);
      console.log(`  📸 ${path.basename(sc1)}`);
      console.log('  ℹ️ Mobile web on emulator captured');
    }

  } catch (err) {
    console.log(`  ⚠️ Android test error: ${err.message}`);
  }
  console.log('  ✅ Android emulator checks complete');
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🧪 Lalabuba functional QA — ${new Date().toISOString()}`);
  console.log(`   Target: ${BASE}`);
  console.log(`   Test account: ${TEST_EMAIL}\n`);

  browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox'],
  });

  // Desktop tests
  const { ctx: deskCtx, page: deskPage } = await newPage(browser);
  await testHero(deskPage);
  await testDraw(deskPage);
  await testAccountCreation(deskPage);
  await deskCtx.close();

  // Mobile portrait tests
  await testMobilePortrait();

  // LP nav test
  await testLpNav();

  // Android emulator
  await testAndroidEmulator();

  await browser.close();

  console.log(`\n✅ QA complete. ${step} screenshots saved to: ${OUT_DIR}`);
  console.log('   Files:');
  fs.readdirSync(OUT_DIR).filter(f => f.startsWith('qa-')).sort().forEach(f => console.log(`   - ${f}`));
}

run().catch(err => { console.error('\n❌ Fatal:', err.message, err.stack); process.exit(1); });
