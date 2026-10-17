// In-app AI-content reports (Google Play AI-Generated Content policy): drives
// api/community/report-content.js + api/admin/content-reports.js with a stub DB.
const path = require("path");
const fs = require("fs");
const root = path.join(__dirname, "..");
delete process.env.BREVO_API_KEY; // never email from tests
const r = (p) => path.join(root, p);

const rows = []; let cfg = { blocked_subjects: "[]" };
const dbStub = {
  async query(sql, params) {
    if (/SELECT id FROM content_reports/.test(sql)) {
      const [u, s, seed, img] = params;
      return { rows: rows.filter(x => x.reporter_uuid === u && x.subject === s && (x.seed || 0) === (seed || 0) && (x.image_path || "") === (img || "")) };
    }
    if (/INSERT INTO content_reports/.test(sql)) {
      const [reporter_uuid, subject, seed, difficulty, source, reason, image_path, evidence_file] = params;
      const id = rows.length + 1; rows.push({ id, reporter_uuid, subject, seed, difficulty, source, reason, image_path, evidence_file, status: "open" });
      return { rows: [{ id }] };
    }
    if (/UPDATE content_reports/.test(sql)) {
      const x = rows.find(y => y.id === params[0]); if (!x) return { rows: [] };
      x.status = params[1]; return { rows: [{ subject: x.subject }] };
    }
    if (/SELECT evidence_file/.test(sql)) return { rows: rows.filter(x => x.id === params[0]) };
    if (/FROM content_reports/.test(sql)) return { rows: /GROUP BY/.test(sql) ? [] : rows };
    throw new Error("unexpected sql " + sql);
  },
  async getConfig(k, d) { return cfg[k] ?? d; },
  async getConfigInt(k, d) { return d; },
  async setConfig(k, v) { cfg[k] = JSON.stringify(v); },
};
require.cache[require.resolve(r("lib/db.js"))] = { exports: dbStub, loaded: true, id: r("lib/db.js") };
require.cache[require.resolve(r("lib/rate-limit.js"))] = { exports: { makeRateLimiter: () => async () => false, consume: async () => ({ limited: false }) }, loaded: true, id: r("lib/rate-limit.js") };

const report = require(r("api/community/report-content.js"));
const admin = require(r("api/admin/content-reports.js"));
const { isAdminBlockedSubject } = require(r("lib/content-safety.js"));

// Put a fake generated image where /img/c serves from.
const cdir = r("data/images/c"); fs.mkdirSync(cdir, { recursive: true });
const png = Buffer.from("89504e470d0a1a0a0000", "hex");
fs.writeFileSync(path.join(cdir, "123-test.png"), png);

function mkRes() {
  const res = { code: 0, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = (b) => { res.body = b; return res; };
  res.writeHead = (c, h) => { res.code = c; };
  return res;
}
const UUID = "123e4567-e89b-42d3-a456-426614174000";
const assert = require("assert");

(async () => {
  let res = mkRes();
  await report({ method: "POST", headers: { "x-device-id": UUID }, socket: {}, body: { reason: "scary", subject: "Scary clown", seed: 123, imageUrl: "https://lalabuba.com/img/c/123-test.png", source: "custom" } }, res);
  assert.strictEqual(res.code, 200, JSON.stringify(res.body)); assert.strictEqual(res.body.id, 1);
  assert.ok(rows[0].evidence_file, "evidence saved");
  const ev = path.join(r("data/reports"), rows[0].evidence_file);
  assert.ok(fs.readFileSync(ev).equals(png), "evidence identical to served image");

  res = mkRes(); // duplicate → idempotent, same id
  await report({ method: "POST", headers: { "x-device-id": UUID }, socket: {}, body: { reason: "other", subject: "Scary clown", seed: 123, imageUrl: "/img/c/123-test.png" } }, res);
  assert.strictEqual(res.code, 200); assert.strictEqual(res.body.id, 1); assert.strictEqual(rows.length, 1);

  res = mkRes(); await report({ method: "POST", headers: { "x-device-id": UUID }, socket: {}, body: { reason: "hack", subject: "x" } }, res);
  assert.strictEqual(res.code, 400);
  res = mkRes(); await report({ method: "POST", headers: {}, socket: {}, body: { reason: "scary", subject: "x" } }, res);
  assert.strictEqual(res.code, 401);

  // Admin: unauth, list, evidence, action+block
  process.env.GALLERY_ADMIN_KEY = "k";
  res = mkRes(); await admin({ method: "GET", url: "/api/admin/content-reports", headers: {} }, res); assert.strictEqual(res.code, 401);
  res = mkRes(); await admin({ method: "GET", url: "/api/admin/content-reports", headers: { "x-admin-key": "k" } }, res);
  assert.strictEqual(res.code, 200); assert.strictEqual(JSON.parse(res.body).reports.length, 1);
  res = mkRes(); await admin({ method: "GET", url: "/api/admin/content-reports?evidence=1", headers: { "x-admin-key": "k" } }, res);
  assert.strictEqual(res.code, 200); assert.ok(res.body.equals(png));
  const post = (b) => { const req = { method: "POST", url: "/api/admin/content-reports", headers: { "x-admin-key": "k" } }; req[Symbol.asyncIterator] = async function* () { yield JSON.stringify(b); }; return req; };
  res = mkRes(); await admin(post({ id: 1, status: "actioned", blockSubject: true }), res);
  assert.strictEqual(res.code, 200, res.body);
  const blocked = JSON.parse(cfg.blocked_subjects);
  assert.deepStrictEqual(blocked, ["scary clown"]);
  assert.ok(isAdminBlockedSubject("a SCARY clown!!", blocked));
  assert.ok(!isAdminBlockedSubject("clown fish", blocked));
  res = mkRes(); await admin(post({ unblockSubject: "Scary Clown" }), res);
  assert.deepStrictEqual(JSON.parse(cfg.blocked_subjects), []);

  fs.unlinkSync(ev); fs.unlinkSync(path.join(cdir, "123-test.png"));
  console.log("ALL SERVER CHECKS PASSED");
})().catch((e) => { console.error(e); process.exit(1); });
