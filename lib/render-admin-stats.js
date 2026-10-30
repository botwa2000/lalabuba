"use strict";
// /admin/stats page shell. All data comes from GET /api/admin/stats (same-origin,
// admin session cookie) and is rendered client-side with inline SVG — no
// external scripts, so nothing third-party ever sees the numbers.
// Every string from the API (prompts, reviews, referrers) is user-generated and
// goes through esc() before touching innerHTML.

function renderAdminStatsPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Lalabuba Stats</title>
<style>
:root{--bg:#f6f6fa;--surface:#fff;--text:#1a1a2e;--muted:#6a6a85;--border:#e4e4ef;--accent:#7C4DFF;
  --web:#7C4DFF;--ios:#2F80ED;--android:#1E9E5A;--app:#9a9ab0;--bad:#d64545;--good:#1E9E5A;--grid:#ececf4}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f19;--surface:#191928;--text:#e8e8f2;--muted:#9a9ab8;--border:#2a2a40;
  --web:#9d7bff;--ios:#5aa2ff;--android:#3cc47c;--app:#6f6f88;--grid:#24243a}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:16px}
.wrap{max-width:1240px;margin:0 auto}
header{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin-bottom:16px}
h1{font-size:1.25rem;font-weight:800;margin-right:auto}
h1 span{color:var(--accent)}
.pills{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:3px}
.pills button{border:0;background:none;color:var(--muted);padding:5px 10px;border-radius:7px;cursor:pointer;font:inherit;font-weight:600}
.pills button.on{background:var(--accent);color:#fff}
.btn{border:1px solid var(--border);background:var(--surface);color:var(--text);padding:6px 10px;border-radius:8px;cursor:pointer;font:inherit;text-decoration:none}
.meta{color:var(--muted);font-size:.8rem;margin-bottom:12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;min-width:0}
.tile .k{color:var(--muted);font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.tile .v{font-size:1.6rem;font-weight:800;margin:2px 0;font-variant-numeric:tabular-nums}
.tile .s{color:var(--muted);font-size:.78rem;overflow-wrap:anywhere}
.up{color:var(--good)} .down{color:var(--bad)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px;margin-bottom:12px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;min-width:0}
.card h2{font-size:.95rem;font-weight:700;margin-bottom:8px;display:flex;gap:8px;align-items:baseline}
.card h2 small{color:var(--muted);font-weight:500;font-size:.75rem}
table{width:100%;border-collapse:collapse;font-size:.84rem}
th{color:var(--muted);font-weight:600;text-align:left;padding:4px 6px;border-bottom:1px solid var(--border)}
td{padding:4px 6px;border-bottom:1px solid var(--grid);vertical-align:top;overflow-wrap:anywhere}
td.nw{white-space:nowrap}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.legend{display:flex;gap:12px;font-size:.76rem;color:var(--muted);margin:4px 0 0;flex-wrap:wrap}
.dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.bar{height:6px;border-radius:3px;background:var(--accent);opacity:.75}
.muted{color:var(--muted)} .bad{color:var(--bad)} .ok{color:var(--good)}
.stars{color:#f5a623;letter-spacing:1px}
.review{border-bottom:1px solid var(--grid);padding:6px 0}
.review:last-child{border:0}
details summary{cursor:pointer;color:var(--accent);font-weight:600;font-size:.84rem;margin:6px 0}
.scroll{max-height:360px;overflow:auto}
svg text{fill:var(--muted);font-size:10px}
.err{background:#fde8e8;color:#8a1c1c;padding:10px 12px;border-radius:8px;margin-bottom:12px}
@media (max-width:420px){.grid{grid-template-columns:1fr}.card{padding:12px}.tile .v{font-size:1.35rem}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>🎨 Lalabuba <span>stats</span></h1>
  <div class="pills" id="range">
    <button data-v="today">Today</button><button data-v="7d">7 days</button><button data-v="30d">30 days</button><button data-v="90d">90 days</button>
  </div>
  <div class="pills" id="platform">
    <button data-v="all">All</button><button data-v="web">Web</button><button data-v="ios">iOS</button><button data-v="android">Android</button>
  </div>
  <button class="btn" id="import" title="Re-run the store imports now">↻ Store import</button>
  <a class="btn" href="/admin/logout">Sign out</a>
</header>
<div class="meta" id="meta">Loading…</div>
<div id="root"></div>
</div>
<script>
(function () {
  "use strict";
  var PCOL = { web: "var(--web)", ios: "var(--ios)", android: "var(--android)", app: "var(--app)" };
  var PNAME = { web: "Web", ios: "iOS", android: "Android", app: "App (old build)" };
  var state = { range: "7d", platform: "all" };
  try { var saved = JSON.parse(localStorage.getItem("lala-stats") || "{}"); if (saved.range) state.range = saved.range; if (saved.platform) state.platform = saved.platform; } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return n == null ? "—" : Number(n).toLocaleString("en-US"); }
  function pct(x, d) { return x == null ? "—" : (x * 100).toFixed(d == null ? 0 : d) + "%"; }
  function delta(cur, prev) {
    if (!prev) return cur ? '<span class="muted">new</span>' : "";
    var d = (cur - prev) / prev;
    return '<span class="' + (d >= 0 ? "up" : "down") + '">' + (d >= 0 ? "▲" : "▼") + " " + Math.abs(d * 100).toFixed(0) + "%</span> vs prev";
  }
  function stars(n) { var r = Math.round(n || 0); return '<span class="stars">' + "★★★★★".slice(0, r) + '<span class="muted">' + "★★★★★".slice(r) + "</span></span>"; }
  function tile(k, v, s) { return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + (s || "&nbsp;") + "</div></div>"; }
  function card(title, body, sub) { return '<div class="card"><h2>' + title + (sub ? " <small>" + sub + "</small>" : "") + "</h2>" + body + "</div>"; }
  function table(cols, rows, empty) {
    if (!rows.length) return '<p class="muted">' + (empty || "No data yet.") + "</p>";
    return "<table><tr>" + cols.map(function (c) { return '<th class="' + (c.n ? "n" : "") + '">' + c.h + "</th>"; }).join("") + "</tr>" +
      rows.map(function (r) { return "<tr>" + cols.map(function (c) { return '<td class="' + (c.n ? "n" : "") + '">' + c.f(r) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>";
  }
  function legend(keys) { return '<div class="legend">' + keys.map(function (k) { return '<span><i class="dot" style="background:' + PCOL[k] + '"></i>' + PNAME[k] + "</span>"; }).join("") + "</div>"; }

  // Stacked daily bars per platform. points: [{day, web:n, ios:n, ...}]
  function stacked(points, keys) {
    var W = 560, H = 150, padL = 30, padB = 18, n = points.length || 1;
    var max = 1;
    points.forEach(function (p) { var t = 0; keys.forEach(function (k) { t += p[k] || 0; }); if (t > max) max = t; });
    var bw = (W - padL) / n, out = [];
    [0, 0.5, 1].forEach(function (f) {
      var y = (H - padB) * (1 - f);
      out.push('<line x1="' + padL + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="var(--grid)"/>');
      out.push('<text x="' + (padL - 4) + '" y="' + (y + 3) + '" text-anchor="end">' + fmt(Math.round(max * f)) + "</text>");
    });
    points.forEach(function (p, i) {
      var y = H - padB, x = padL + i * bw + bw * 0.15, w = Math.max(1, bw * 0.7), tot = 0;
      keys.forEach(function (k) {
        var v = p[k] || 0; if (!v) return; tot += v;
        var h = (H - padB) * v / max; y -= h;
        out.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + PCOL[k] + '" rx="1.5"><title>' + p.day + " " + PNAME[k] + ": " + fmt(v) + "</title></rect>");
      });
      var every = Math.ceil(n / 8);
      if (i % every === 0 || n <= 8) out.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + p.day.slice(5) + "</text>");
    });
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img">' + out.join("") + "</svg>";
  }
  function keysIn(points) {
    var seen = {};
    points.forEach(function (p) { Object.keys(p).forEach(function (k) { if (PCOL[k] && p[k]) seen[k] = 1; }); });
    return ["web", "ios", "android", "app"].filter(function (k) { return seen[k]; });
  }
  function hbars(rows, label, value) {
    if (!rows.length) return '<p class="muted">No data yet.</p>';
    var max = Math.max.apply(null, rows.map(value)) || 1;
    return "<table>" + rows.map(function (r) {
      return '<tr><td style="width:40%">' + label(r) + '</td><td style="width:45%"><div class="bar" style="width:' + (100 * value(r) / max).toFixed(1) + '%"></div></td><td class="n">' + fmt(value(r)) + "</td></tr>";
    }).join("") + "</table>";
  }
  function ago(ts) {
    var s = (Date.now() - new Date(ts).getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    return Math.round(s / 86400) + "d ago";
  }

  function render(d) {
    var k = d.kpis.cur, kp = d.kpis.prev, st = d.store, rv = st.reviews, h = d.health;
    var dlIos = st.downloads.ios || 0, dlAnd = st.downloads.android || 0;
    var dlPrev = (st.prevDownloads.ios || 0) + (st.prevDownloads.android || 0);
    var failRate = (k.drawings + k.failed) ? k.failed / (k.drawings + k.failed) : null;
    var html = [];

    html.push('<div class="tiles">' +
      tile("Active users", fmt(k.activeUsers), "≈ " + (k.avgDailyUsers < 10 ? k.avgDailyUsers.toFixed(1) : fmt(Math.round(k.avgDailyUsers))) + "/day · " + delta(k.activeUsers, kp.activeUsers)) +
      tile("New users", fmt(k.newUsers), ["new installs / IDs", delta(k.newUsers, kp.newUsers)].filter(Boolean).join(" · ")) +
      tile("Drawings", fmt(k.drawings), (failRate == null ? "" : '<span class="' + (failRate > 0.05 ? "bad" : "") + '">' + pct(failRate, 1) + " failed</span> · ") + delta(k.drawings, kp.drawings)) +
      tile("Completed", fmt(k.completed), (k.drawings ? pct(k.completed / k.drawings) + " of drawings · " : "") + delta(k.completed, kp.completed)) +
      (d.platform === "web" ? "" : tile("Downloads", fmt(dlIos + dlAnd), ["iOS " + fmt(dlIos), "Android " + fmt(dlAnd), delta(dlIos + dlAnd, dlPrev)].filter(Boolean).join(" · "))) +
      (rv ? tile("Total reviews", fmt(rv.total), (rv.avg ? stars(rv.avg) + " " + rv.avg.toFixed(2) : "no ratings yet")) : "") +
      tile("Retention", pct(d.retention.d1) + " / " + pct(d.retention.d7), "D1 / D7 · cohorts " + fmt(d.retention.d1Base) + " / " + fmt(d.retention.d7Base)) +
      "</div>");

    var ak = keysIn(d.series.activeUsers), dk = keysIn(d.series.drawings), sk = keysIn(d.series.downloads);
    var fails = d.series.drawings.reduce(function (a, p) { return a + p._fail; }, 0);
    html.push('<div class="grid">' +
      card("Active users per day", stacked(d.series.activeUsers, ak) + legend(ak), "unique installs + web visitors") +
      card("Drawings per day", stacked(d.series.drawings, dk) + legend(dk), fmt(fails) + " failed in range") +
      (d.platform === "web" ? "" : card("Downloads per day", stacked(d.series.downloads, sk) + legend(sk), "App Store + Google Play")) +
      "</div>");

    // Prompts
    var top = table([
      { h: "Prompt", f: function (r) { return esc(r.subject); } },
      { h: "Total", n: 1, f: function (r) { return fmt(r.n); } },
      { h: "Web", n: 1, f: function (r) { return fmt(r.web); } },
      { h: "iOS", n: 1, f: function (r) { return fmt(r.ios); } },
      { h: "Android", n: 1, f: function (r) { return fmt(r.android); } },
    ], d.prompts.top);
    var typed = table([
      { h: "When", f: function (r) { return '<span class="muted">' + ago(r.ts) + "</span>"; } },
      { h: "Typed", f: function (r) { return esc(r.subject_raw) + (r.subject_en && r.subject_en !== String(r.subject_raw).toLowerCase() ? ' <span class="muted">→ ' + esc(r.subject_en) + "</span>" : ""); } },
      { h: "", f: function (r) { return '<i class="dot" style="background:' + (PCOL[r.platform] || "var(--app)") + '"></i>' + esc(r.lang || "") + (r.outcome !== "ok" ? ' <span class="bad">' + esc(r.outcome) + "</span>" : ""); } },
    ], d.prompts.latestTyped, "No typed prompts in the last 30 days.");
    html.push('<div class="grid">' +
      card("Top prompts", '<div class="scroll">' + top + "</div>", "successful drawings, English subject") +
      card("Where prompts come from", hbars(d.prompts.bySource, function (r) { return esc(r.source); }, function (r) { return Number(r.n); }) +
        '<details><summary>Latest 50 typed prompts</summary><div class="scroll">' + typed + "</div></details>", "raw text kept 30 days") +
      "</div>");

    // Usage
    var actions = Object.keys(d.usage.actions).sort(function (a, b) { return d.usage.actions[b].total - d.usage.actions[a].total; }).map(function (e) { var a = d.usage.actions[e]; return { e: e, a: a }; });
    html.push('<div class="grid">' +
      card("App screens", table([
        { h: "Screen", f: function (r) { return esc(r.screen); } },
        { h: "Views", n: 1, f: function (r) { return fmt(r.n); } },
        { h: "Users", n: 1, f: function (r) { return fmt(r.users); } }], d.usage.screens, "No app screen views yet (needs app 1.0.24+).")) +
      card("Web pages", table([
        { h: "Page", f: function (r) { return esc(r.screen); } },
        { h: "Views", n: 1, f: function (r) { return fmt(r.n); } },
        { h: "Visitors", n: 1, f: function (r) { return fmt(r.users); } }], d.usage.pages)) +
      card("What people do", table([
        { h: "Action", f: function (r) { return esc(r.e.replace(/_/g, " ")); } },
        { h: "Total", n: 1, f: function (r) { return fmt(r.a.total); } },
        { h: "Web", n: 1, f: function (r) { return fmt(r.a.web); } },
        { h: "iOS", n: 1, f: function (r) { return fmt(r.a.ios); } },
        { h: "Android", n: 1, f: function (r) { return fmt(r.a.android); } }], actions)) +
      "</div>");

    // Acquisition
    var ac = d.acquisition;
    html.push('<div class="grid">' +
      card("Visit sources", table([
        { h: "Source", f: function (r) { return esc(r.source) + (r.medium ? ' <span class="muted">' + esc(r.medium) + "</span>" : ""); } },
        { h: "Campaign", f: function (r) { return esc(r.campaign || ""); } },
        { h: "Visits", n: 1, f: function (r) { return fmt(r.n); } }], ac.visits, "No referred visits yet."), "referrer domain / UTM") +
      card("New users by source", table([
        { h: "", f: function (r) { return '<i class="dot" style="background:' + (PCOL[r.platform] || "var(--app)") + '"></i>'; } },
        { h: "Source", f: function (r) { return esc(r.source) + (r.campaign ? ' <span class="muted">' + esc(r.campaign) + "</span>" : ""); } },
        { h: "Users", n: 1, f: function (r) { return fmt(r.n); } }], ac.installs), "first touch; Android via Play Install Referrer") +
      card("Challenge links", '<div class="tiles" style="grid-template-columns:repeat(3,1fr);margin:0">' +
        tile("Created", fmt(ac.challenge.created)) + tile("Opened", fmt(ac.challenge.opened)) + tile("New users", fmt(ac.challenge.newUsers)) + "</div>") +
      card("Store sources", table([
        { h: "", f: function (r) { return '<i class="dot" style="background:' + PCOL[r.platform] + '"></i>'; } },
        { h: "Source / campaign", f: function (r) { return esc(r.metric.replace(/^src:/, "").replace(/^cmp:/, "campaign: ").replace(/^ref:/, "referrer: ")); } },
        { h: "Downloads", n: 1, f: function (r) { return fmt(r.n); } }], ac.store, "Needs the store import (see Imports below)."), "App Store Analytics · Play acquisition") +
      "</div>");

    // Reviews
    if (rv) {
      var per = Object.keys(rv.perPlatform).map(function (p) {
        var t = rv.perPlatform[p];
        return '<p style="margin-bottom:6px"><i class="dot" style="background:' + PCOL[p] + '"></i><b>' + PNAME[p] + "</b> " +
          (t.avg ? stars(t.avg) + " " + t.avg.toFixed(2) : '<span class="muted">no rating yet</span>') + " · " + fmt(t.ratings) +
          (t.ratingsIsWrittenOnly ? " written reviews" : " ratings") + " · " + fmt(t.written) + " written (" + fmt(t.writtenPeriod) + " in range)" +
          (t.activeDevices != null ? " · " + fmt(t.activeDevices) + " active devices" : "") + "</p>";
      }).join("");
      var recent = rv.recent.length ? rv.recent.map(function (r) {
        return '<div class="review"><i class="dot" style="background:' + PCOL[r.platform] + '"></i>' + stars(r.rating) + ' <span class="muted">' + esc(String(r.created_at).slice(0, 10)) + " " + esc(r.territory || r.lang || "") + (r.app_version ? " v" + esc(r.app_version) : "") + "</span>" +
          (r.title ? "<br><b>" + esc(r.title) + "</b>" : "") + (r.body ? "<br>" + esc(r.body) : "") + "</div>";
      }).join("") : '<p class="muted">No written reviews imported yet.</p>';
      html.push('<div class="grid">' + card("Store reviews · " + fmt(rv.total) + " total", per) + card("Latest reviews", '<div class="scroll">' + recent + "</div>") + "</div>");
    }

    // Health
    var bot = Object.keys(h.botGate).sort().reverse().slice(0, 7).map(function (day) { var c = h.botGate[day]; return { day: day, c: c }; });
    html.push('<div class="grid">' +
      card("Image providers", table([
        { h: "Provider", f: function (r) { return esc(r.provider); } },
        { h: "Drawings", n: 1, f: function (r) { return fmt(r.n); } },
        { h: "p50", n: 1, f: function (r) { return r.p50 == null ? "—" : (r.p50 / 1000).toFixed(1) + "s"; } },
        { h: "p95", n: 1, f: function (r) { return r.p95 == null ? "—" : (r.p95 / 1000).toFixed(1) + "s"; } }], h.providers) +
        '<p class="muted" style="margin-top:8px">Budget today: <b>' + fmt(h.budget.used) + "</b> / " + fmt(h.budget.limit) +
        '  · Open content reports: <b class="' + (h.openReports ? "bad" : "") + '">' + fmt(h.openReports) + "</b></p>") +
      card("Request outcomes", hbars(h.outcomes, function (r) { return '<span class="' + (r.outcome === "ok" ? "ok" : r.outcome === "fail" ? "bad" : "") + '">' + esc(r.outcome) + "</span>"; }, function (r) { return Number(r.n); }) +
        "<details><summary>Bot gate per day</summary>" + table([
          { h: "Day", f: function (r) { return esc(r.day.slice(5)); } },
          { h: "Web ok", n: 1, f: function (r) { return fmt(r.c.web_turnstile_ok); } },
          { h: "Web fail", n: 1, f: function (r) { return fmt(r.c.web_turnstile_fail); } },
          { h: "App attested", n: 1, f: function (r) { return fmt(r.c.native_attested); } },
          { h: "Unattested", n: 1, f: function (r) { return fmt((r.c.native_unattested_allowed || 0) + (r.c.native_unattested_blocked || 0)); } }], bot) + "</details>") +
      card("Countries", hbars(h.countries, function (r) { return esc(r.country); }, function (r) { return Number(r.users); }), "users") +
      card("Languages", hbars(h.languages, function (r) { return esc(r.lang); }, function (r) { return Number(r.n); }), "drawings") +
      card("App versions", table([
        { h: "", f: function (r) { return '<i class="dot" style="background:' + PCOL[r.platform] + '"></i>'; } },
        { h: "Version", f: function (r) { return esc(r.app_version); } },
        { h: "Installs", n: 1, f: function (r) { return fmt(r.installs); } }], h.versions, "Needs app 1.0.24+.")) +
      card("Store imports", table([
        { h: "Feed", f: function (r) { return '<span style="white-space:nowrap">' + esc(r.source) + "</span>"; } },
        { h: "", f: function (r) { return r.ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'; } },
        { h: "Last run", f: function (r) { return '<span class="muted">' + ago(r.ran_at) + "</span>"; } },
        { h: "Detail", f: function (r) { return '<span class="muted">' + esc(r.detail) + "</span>"; } }], h.imports, "Not run yet — first run ~2 min after deploy, then nightly 04:30 UTC."), "nightly 04:30 UTC") +
      "</div>");

    document.getElementById("root").innerHTML = html.join("");
  }

  function setPills() {
    ["range", "platform"].forEach(function (id) {
      Array.prototype.forEach.call(document.querySelectorAll("#" + id + " button"), function (b) { b.classList.toggle("on", b.dataset.v === state[id]); });
    });
  }

  function load() {
    setPills();
    try { localStorage.setItem("lala-stats", JSON.stringify(state)); } catch (e) {}
    document.getElementById("meta").textContent = "Loading…";
    fetch("/api/admin/stats?range=" + state.range + "&platform=" + state.platform, { credentials: "same-origin" })
      .then(function (r) { if (r.status === 401) { location.href = "/admin/login"; throw new Error("auth"); } return r.json(); })
      .then(function (d) {
        document.getElementById("meta").textContent = d.from + " → " + d.to + " (UTC) · " + (PNAME[d.platform] || "All platforms") + " · updated " + new Date(d.generatedAt).toLocaleTimeString();
        render(d);
      })
      .catch(function (e) { if (e.message !== "auth") document.getElementById("root").innerHTML = '<div class="err">Could not load stats: ' + esc(e.message) + "</div>"; });
  }

  ["range", "platform"].forEach(function (id) {
    document.getElementById(id).addEventListener("click", function (e) {
      var v = e.target.dataset && e.target.dataset.v; if (!v) return; state[id] = v; load();
    });
  });
  document.getElementById("import").addEventListener("click", function () {
    var b = this; b.disabled = true; b.textContent = "Import started…";
    fetch("/api/admin/stats", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import" }) })
      .then(function () { setTimeout(function () { b.disabled = false; b.textContent = "↻ Store import"; load(); }, 20000); });
  });
  load();
  setInterval(function () { if (!document.hidden) load(); }, 5 * 60 * 1000);
})();
</script>
</body>
</html>`;
}

module.exports = { renderAdminStatsPage };
