"use strict";
// /api/admin/content-reports — review in-app reports of AI-generated pictures
// (api/community/report-content.js). Auth: X-Admin-Key = GALLERY_ADMIN_KEY.
//
// GET  ?status=open|dismissed|actioned|all&limit=N
//        → { reports: [...], blockedSubjects: [...], summary: [{subject, open, total}] }
// GET  ?evidence=<id>  → the privately stored reported picture (image/*)
// POST { id, status: "dismissed"|"actioned", note?, blockSubject?: true }
//        → closes the report; blockSubject also adds its subject to the
//          `blocked_subjects` config that api/generate-image.js enforces.
// POST { unblockSubject: "..." } → removes a subject from that list.

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const db     = require("../../lib/db");
const { subjectKey } = require("../../lib/content-safety");

const REPORTS_DIR = path.join(__dirname, "../../data/reports");
const STATUSES    = new Set(["open", "dismissed", "actioned"]);

function isAdmin(req) {
  const expected = process.env.GALLERY_ADMIN_KEY;
  const got = req.headers["x-admin-key"];
  if (!expected || typeof got !== "string") return false;
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("body too large");
  }
  return JSON.parse(raw || "{}");
}

async function getBlocked() {
  try {
    const list = JSON.parse((await db.getConfig("blocked_subjects", "[]")) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

module.exports = async function adminContentReportsHandler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: "Unauthorized" });
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET") {
      const evidenceId = url.searchParams.get("evidence");
      if (evidenceId) {
        const { rows } = await db.query("SELECT evidence_file FROM content_reports WHERE id = $1", [parseInt(evidenceId) || 0]);
        const file = rows[0] && rows[0].evidence_file;
        if (!file || !/^[A-Za-z0-9_.-]+$/.test(file)) return send(res, 404, { error: "No evidence for this report." });
        let buf;
        try { buf = fs.readFileSync(path.join(REPORTS_DIR, file)); }
        catch { return send(res, 404, { error: "Evidence file missing." }); }
        const ct = /\.jpe?g$/i.test(file) ? "image/jpeg" : "image/png";
        res.writeHead(200, { "Content-Type": ct, "Cache-Control": "no-store" });
        return res.end(buf);
      }

      const status = url.searchParams.get("status") || "open";
      const limit  = Math.min(Math.max(parseInt(url.searchParams.get("limit")) || 100, 1), 500);
      const where  = STATUSES.has(status) ? "WHERE status = $2" : "";
      const params = STATUSES.has(status) ? [limit, status] : [limit];
      const [{ rows: reports }, { rows: summary }, blockedSubjects] = await Promise.all([
        db.query(
          `SELECT id, created_at, subject, seed, difficulty, source, reason, image_path,
                  evidence_file IS NOT NULL AS has_evidence, platform, app_version,
                  status, reviewed_at, review_note
           FROM content_reports ${where} ORDER BY created_at DESC LIMIT $1`,
          params
        ),
        db.query(
          `SELECT lower(subject) AS subject,
                  COUNT(*) FILTER (WHERE status = 'open') AS open,
                  COUNT(*) AS total
           FROM content_reports GROUP BY lower(subject)
           ORDER BY open DESC, total DESC LIMIT 50`
        ),
        getBlocked(),
      ]);
      return send(res, 200, { reports, summary, blockedSubjects });
    }

    if (req.method === "POST") {
      let body;
      try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

      if (typeof body.unblockSubject === "string") {
        const key = subjectKey(body.unblockSubject);
        const next = (await getBlocked()).filter((s) => subjectKey(s) !== key);
        await db.setConfig("blocked_subjects", next);
        console.warn(`[admin/content-reports] unblocked subject "${key}"`);
        return send(res, 200, { ok: true, blockedSubjects: next });
      }

      const id = parseInt(body.id);
      if (!Number.isFinite(id)) return send(res, 400, { error: "id required." });
      if (!["dismissed", "actioned"].includes(body.status)) {
        return send(res, 400, { error: 'status must be "dismissed" or "actioned".' });
      }
      const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
      const { rows } = await db.query(
        `UPDATE content_reports SET status = $2, review_note = $3, reviewed_at = NOW()
         WHERE id = $1 RETURNING subject`,
        [id, body.status, note]
      );
      if (!rows.length) return send(res, 404, { error: "Report not found." });

      let blockedSubjects = await getBlocked();
      if (body.blockSubject === true) {
        const key = subjectKey(rows[0].subject);
        if (key && !blockedSubjects.some((s) => subjectKey(s) === key)) {
          blockedSubjects = [...blockedSubjects, key];
          await db.setConfig("blocked_subjects", blockedSubjects);
          console.warn(`[admin/content-reports] blocked subject "${key}" (report #${id})`);
        }
      }
      return send(res, 200, { ok: true, blockedSubjects });
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[admin/content-reports]", err.message);
    return send(res, 500, { error: "Internal server error" });
  }
};
