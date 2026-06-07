const { chromium } = require('playwright');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const p = await (await b.newContext({ viewport: { width: 412, height: 892 } })).newPage();
  await p.goto('https://lalabuba.com/?cb=ovl', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  // Force the verify state and put a stand-in box where the Turnstile checkbox renders
  const r = await p.evaluate(() => {
    document.body.classList.add('ts-verifying');
    const w = document.getElementById('turnstile-widget');
    w.innerHTML = '<div style="width:300px;height:65px;background:#eee"></div>'; // mimic checkbox
    const instr = document.getElementById('turnstile-instruction');
    const ib = instr.getBoundingClientRect();
    const wb = w.getBoundingClientRect();
    const cs = getComputedStyle(instr);
    return {
      instructionBottom: Math.round(ib.bottom),
      checkboxTop: Math.round(wb.top),
      gap: Math.round(wb.top - ib.bottom),
      overlaps: ib.bottom > wb.top,
      instructionPointerEvents: cs.pointerEvents,
      vh: window.innerHeight,
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
