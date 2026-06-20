// Real store screenshots — captures the LIVE responsive web app at each store
// device's exact pixel size, the same way scripts/screenshot-qa.js does visual QA.
// No mockups: these are genuine app screens.
//
// Usage: node scripts/store-screenshots.js [langs] [deviceFilter] [url]
//   langs        comma list (default: en)            e.g. en,de,fr
//   deviceFilter comma list of device keys or 'all'  e.g. iphone_6_9,ipad_13
//   url          default https://lalabuba.com
//
// Coloring state uses the built-in demo provider (no API / no Turnstile), and a
// rich progress state is seeded into localStorage so the rewards album, crayon
// packs, daily mission and decorated mascot all render fully populated.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const LANGS  = (process.argv[2] || 'en').split(',');
const FILTER = (process.argv[3] || 'all');
const URL    = process.argv[4] || 'https://lalabuba.com';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT   = path.join(__dirname, '..');

// device key -> exact store px (w,h) + logical viewport (vpw,vph) and DSF so
// screenshot(fullPage:false) === w×h exactly.  store: ios|play.  phone: layout hint.
const DEVICES = [
  // iOS  → app-store-assets/<lang>/<dir>/
  { key:'iphone_6_9',           store:'ios',  w:1320, h:2868, vpw:440,  vph:956,  dsf:3, phone:true  },
  { key:'iphone_6_9_landscape', store:'ios',  w:2868, h:1320, vpw:956,  vph:440,  dsf:3, phone:true  },
  { key:'iphone_6_5',           store:'ios',  w:1284, h:2778, vpw:428,  vph:926,  dsf:3, phone:true  },
  { key:'iphone_6_5_landscape', store:'ios',  w:2778, h:1284, vpw:926,  vph:428,  dsf:3, phone:true  },
  { key:'ipad_13',              store:'ios',  w:2048, h:2732, vpw:1024, vph:1366, dsf:2, phone:false },
  { key:'ipad_13_landscape',    store:'ios',  w:2732, h:2048, vpw:1366, vph:1024, dsf:2, phone:false },
  // Android → store-assets/play-store-listing/screenshots/<lang>/<dir>/
  { key:'phone',                store:'play', w:1080, h:1920, vpw:360,  vph:640,  dsf:3, phone:true  },
  { key:'phone_landscape',      store:'play', w:1920, h:1080, vpw:640,  vph:360,  dsf:3, phone:true  },
  { key:'tablet_7',             store:'play', w:1200, h:1920, vpw:400,  vph:640,  dsf:3, phone:false },
  { key:'tablet_7_landscape',   store:'play', w:1920, h:1200, vpw:640,  vph:400,  dsf:3, phone:false },
  { key:'tablet_10',            store:'play', w:1600, h:2560, vpw:800,  vph:1280, dsf:2, phone:false },
  { key:'tablet_10_landscape',  store:'play', w:2560, h:1600, vpw:1280, vph:800,  dsf:2, phone:false },
];

const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PAD_UA   = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1';

const EARNED = ['first','five','ten','twentyfive','fifty','streak3','streak7','streak14','explorer','animalPal','onTheMove','foodie','natureFan','peoplePal','rainbow','maxColors','paletteMaster','inventor','penArtist','saver','collector','sharer','challenger','dailyStar'];
function seedProgress(){
  return {
    totalCompleted:62, totalGenerated:90, streak:8, longestStreak:14,
    lastColoredDay:null, daysColored:30, hardCompleted:12, extremeCompleted:3,
    maxColorUses:4, freeTextCreations:9, drawPenUses:5, shares:7, saves:18,
    challengesCreated:3, dailyWordsCompleted:6, uniqueSubjects:14,
    subjects:{butterfly:4,dragon:3,unicorn:2,rocket:2,cat:3,penguin:5},
    palettesUsed:['classic','pastel','nature','neon','candy','galaxy'],
    themesColored:['animals','vehicles','food','nature','people','fantasy'],
    badges:EARNED, today:{day:null,generated:2,completed:1},
  };
}
const MASCOT = { first:[0.5,0.18], rainbow:[0.30,0.52], sharer:[0.70,0.55], streak7:[0.5,0.80], explorer:[0.5,0.40] };

function outDir(d, lang){
  return d.store==='ios'
    ? path.join(ROOT,'app-store-assets',lang,d.key)
    : path.join(ROOT,'store-assets','play-store-listing','screenshots',lang,d.key);
}

async function snap(page, dir, name){
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({ path: path.join(dir, name+'.png'), fullPage:false });
  console.log('    ✓ '+name);
}

async function run(){
  const browser = await chromium.launch({ executablePath:CHROME, headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--force-color-profile=srgb'] });
  const devices = FILTER==='all' ? DEVICES : DEVICES.filter(d=>FILTER.split(',').includes(d.key));

  for(const lang of LANGS){
    console.log(`\n===== ${lang} =====`);
    for(const d of devices){
      console.log(`  ${d.store}/${d.key} (${d.w}×${d.h})`);
      const ctx = await browser.newContext({
        viewport:{width:d.vpw,height:d.vph}, deviceScaleFactor:d.dsf,
        isMobile:d.phone, hasTouch:true,
        userAgent: d.phone ? PHONE_UA : PAD_UA,
        locale: lang,
      });
      // seed BEFORE any page script runs + hide web-only chrome (cookie banner, Turnstile)
      await ctx.addInitScript(([prog, mascot, lng])=>{
        try{
          localStorage.setItem('lalabuba-progress-v1', prog);
          localStorage.setItem('lalabuba-mascot-decor-v1', mascot);
          localStorage.setItem('lalabuba-lang', lng);
          localStorage.setItem('lala_cookie_consent', JSON.stringify({analytics:false, ts:1700000000000}));
        }catch(e){}
        const css = '#turnstile-widget,#turnstile-instruction,.cf-turnstile,#cookie-banner{display:none !important;visibility:hidden !important;}';
        const inject = ()=>{ const s=document.createElement('style'); s.textContent=css; (document.head||document.documentElement).appendChild(s); };
        if(document.head) inject(); else document.addEventListener('DOMContentLoaded', inject);
      }, [JSON.stringify(seedProgress()), JSON.stringify(MASCOT), lang]);

      const page = await ctx.newPage();
      page.on('console',()=>{}); page.on('pageerror',()=>{});

      try{
        // ── hero ──
        await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
        await page.waitForTimeout(2200);
        await snap(page, outDir(d,lang), '1-create');

        // ── coloring (demo provider, no API/Turnstile) ──
        await page.evaluate(()=>{
          window.Capacitor = { isNativePlatform:()=>true, Plugins:{ SplashScreen:{ hide:()=>Promise.resolve() } } };
          const sel=document.getElementById('provider-select');
          if(sel){ sel.value='demo'; sel.dispatchEvent(new Event('change')); }
          const panel=document.getElementById('config-panel'); if(panel) panel.classList.remove('collapsed');
        });
        await page.fill('#subject','butterfly',{force:true});
        const submitted = await page.evaluate(()=>{
          const form=document.getElementById('generator-form'); const btn=document.getElementById('generate-button');
          if(form && !btn?.disabled){ form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); return true; }
          return false;
        });
        if(!submitted){ try{ await page.click('#generate-button',{force:true}); }catch(e){} }

        try{
          await page.waitForFunction(()=>{
            const c=document.getElementById('preview-canvas');
            const ov=document.getElementById('loading-overlay');
            return c && !c.hidden && c.width>100 && !(ov && getComputedStyle(ov).display!=='none');
          },{timeout:15000});
          await page.waitForTimeout(1600);
          await snap(page, outDir(d,lang), '2-color');
        }catch(e){ console.log('    ✗ coloring timed out: '+e.message); }

        // ── rewards: open journal ──
        await page.evaluate(()=>{ const m=document.getElementById('gallery-modal'); if(m) m.classList.remove('hidden'); const b=document.getElementById('journal-btn'); if(b) b.click(); });
        await page.waitForTimeout(1200);
        // 3-rewards — top of journal (streak / mission / crayon packs)
        try{
          await page.evaluate(()=>{ document.getElementById('journal-stats')?.scrollIntoView({block:'start'}); });
          await page.waitForTimeout(400);
          await snap(page, outDir(d,lang), '3-rewards');
        }catch(e){ console.log('    ✗ rewards: '+e.message); }
        // 4-stickers — scroll the grouped sticker album into view
        try{
          const has = await page.evaluate(()=>{ const el=document.getElementById('sticker-shelf'); if(!el) return false; el.scrollIntoView({block:'center'}); return true; });
          if(has){ await page.waitForTimeout(500); await snap(page, outDir(d,lang), '4-stickers'); }
        }catch(e){ console.log('    ✗ stickers: '+e.message); }

        // ── 5-mascot modal ──
        try{
          const mc = await page.$('#mascot-card');
          if(mc){ await mc.click(); await page.waitForTimeout(1000); await snap(page, outDir(d,lang),'5-mascot'); }
        }catch(e){ console.log('    ✗ mascot: '+e.message); }

      }catch(e){ console.log('  ✗ device failed: '+e.message); }
      await ctx.close();
    }
  }
  await browser.close();
  console.log('\nDone.');
}
run().catch(e=>{ console.error('Fatal:',e.message); process.exit(1); });
