// Regression test: the Search Console import retries a transient Google 5xx
// ("Internal error encountered.", 2026-11-26 stopped URL inspection at 481/500)
// with exponential backoff, and returns 4xx / 429 at once.
// Run: node scripts/test-gsc-retry.js   (no network, no database)
const si = require("../lib/store-import.js");

let failures = 0;
const check = (n, c) => { console.log(`  ${c ? "ok  " : "FAIL"} ${n}`); if (!c) failures++; };

const waits = [];
si._setRetrySleep(async (ms) => { waits.push(ms); });

function stub(seq) {
  let calls = 0;
  global.fetch = async () => {
    const step = seq[Math.min(calls++, seq.length - 1)];
    if (step === "throw") throw new Error("The operation was aborted due to timeout");
    return { status: step, text: async () => JSON.stringify(step === 200 ? { ok: 1 } : { error: { code: step } }) };
  };
  return () => calls;
}

(async () => {
  console.log("fetchJsonRetry");

  let calls = stub([500, 503, 200]);
  waits.length = 0;
  let r = await si._fetchJsonRetry("https://x", {});
  check("500, 503 then 200 → 200 on the 3rd attempt", r.status === 200 && r.attempts === 3 && calls() === 3);
  check("backoff grows: ~1 s then ~2 s", waits.length === 2 && waits[0] >= 750 && waits[0] <= 1250 && waits[1] >= 1500 && waits[1] <= 2500);

  calls = stub([500]);
  waits.length = 0;
  r = await si._fetchJsonRetry("https://x", {});
  check("5xx every time → gives up after 5 attempts with the last status", r.status === 500 && r.attempts === 5 && calls() === 5);
  check("4 waits, last ~8 s", waits.length === 4 && waits[3] >= 6000 && waits[3] <= 10000);

  calls = stub([429]);
  r = await si._fetchJsonRetry("https://x", {});
  check("429 quota → no retry", r.status === 429 && calls() === 1);

  calls = stub([403]);
  r = await si._fetchJsonRetry("https://x", {});
  check("403 → no retry", r.status === 403 && calls() === 1);

  calls = stub(["throw", 200]);
  r = await si._fetchJsonRetry("https://x", {});
  check("timeout then 200 → retried", r.status === 200 && calls() === 2);

  calls = stub(["throw"]);
  let threw = false;
  try { await si._fetchJsonRetry("https://x", {}, { retries: 2 }); } catch { threw = true; }
  check("timeout every time → throws after retries", threw && calls() === 3);

  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
})();
