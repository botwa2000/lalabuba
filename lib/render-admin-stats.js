"use strict";
// /admin/stats page shell. All data comes from GET /api/admin/stats (same-origin,
// admin session cookie) and is rendered client-side with inline SVG — no
// external scripts, so nothing third-party ever sees the numbers.
// Every string from the API (prompts, reviews, referrers) is user-generated and
// goes through esc() before touching innerHTML. Chart and label helpers live in
// lib/admin-stats-view.js, which is inlined here so unit tests run the same code.

const { viewHelpers } = require("./admin-stats-view");

function renderAdminStatsPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Lalabuba Stats</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{--bg:#f6f6fa;--surface:#fff;--text:#1a1a2e;--muted:#6a6a85;--border:#e4e4ef;--accent:#7C4DFF;
  --web:#7c3aed;--ios:#0a9490;--android:#d97706;--app:#9a9ab0;--bad:#d64545;--good:#1E9E5A;--grid:#ececf4}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f19;--surface:#191928;--text:#e8e8f2;--muted:#9a9ab8;--border:#2a2a40;
  --web:#8d6ef2;--ios:#17a394;--android:#c4851f;--app:#6f6f88;--grid:#24243a}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:16px}
.wrap{max-width:1240px;margin:0 auto}
header{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin-bottom:16px}
h1{font-size:1.25rem;font-weight:800;margin-right:auto}
h1 span{color:var(--accent)}
.pills{display:flex;flex-wrap:wrap;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:3px}
.pills button{border:0;background:none;color:var(--muted);padding:5px 10px;border-radius:7px;cursor:pointer;font:inherit;font-weight:600}
.pills button.on{background:var(--accent);color:#fff}
.btn{border:1px solid var(--border);background:var(--surface);color:var(--text);padding:6px 10px;border-radius:8px;cursor:pointer;font:inherit;text-decoration:none}
.meta{color:var(--muted);font-size:.8rem;margin-bottom:12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;min-width:0}
.tile .k{color:var(--muted);font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.tile .v{font-size:1.6rem;font-weight:800;margin:2px 0;font-variant-numeric:tabular-nums}
.tile .v.tight{font-size:1rem;line-height:2.06rem}
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
h2.sec{font-size:1.05rem;font-weight:800;margin:20px 0 10px}
.badge{display:inline-block;font-size:.7rem;font-weight:700;padding:1px 6px;border-radius:6px;background:var(--grid);color:var(--muted)}
.badge.ok{background:rgba(30,158,90,.15);color:var(--good)}
.big{font-size:2rem;font-weight:800;font-variant-numeric:tabular-nums}
.err{background:#fde8e8;color:#8a1c1c;padding:10px 12px;border-radius:8px;margin-bottom:12px}
.period{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:-6px 0 10px}
.period span{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.period input{border:1px solid var(--border);background:var(--surface);color:var(--text);padding:5px 8px;border-radius:8px;font:inherit}
.btn:disabled{opacity:.4;cursor:default}
.report{padding:10px 0;border-top:1px solid var(--border)}.report:first-child{border-top:0;padding-top:0}
.report-img{display:block;max-width:220px;width:100%;margin-top:6px;border-radius:8px;background:#fff}
.report-actions{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}
.xscroll{overflow:auto;max-height:440px}
.xscroll table{min-width:560px}
.xscroll th{position:sticky;top:0;background:var(--surface)}
.xscroll td:first-child{white-space:nowrap}
tr.we td{background:var(--grid)}
.full{margin-bottom:12px}
.card.wide{grid-column:1/-1}
.card svg{max-height:220px;display:block}
.tw{overflow-x:auto}
.wide td:first-child{min-width:130px}
.xscroll .tw{overflow:visible}
.note{background:var(--surface);border:1px dashed var(--border);border-radius:10px;padding:8px 12px;font-size:.82rem;color:var(--muted);margin-bottom:12px}
.note a{color:var(--accent);cursor:pointer;text-decoration:underline}
a[data-journey]{color:var(--accent);cursor:pointer;text-decoration:underline;font-family:ui-monospace,monospace}
#journey td{vertical-align:top}
.jr{overflow-x:auto}
.jr table{min-width:900px}
.jr td{white-space:nowrap}
#journey .tw{overflow-x:auto}
#journey table{min-width:520px}
p.secnote{color:var(--muted);font-size:.8rem;margin:-6px 0 10px}
.hit{fill:transparent}
.hit:hover{fill:var(--accent);fill-opacity:.1}
#tip{position:fixed;z-index:9;left:0;top:0;pointer-events:none;display:none;background:var(--text);color:var(--surface);font-size:.76rem;line-height:1.4;padding:6px 9px;border-radius:8px;max-width:240px;white-space:pre-line;font-variant-numeric:tabular-nums}
@media (max-width:420px){.pills button{padding:5px 8px}.grid{grid-template-columns:1fr}.card{padding:12px}.tile .v{font-size:1.35rem}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>🎨 Lalabuba <span>stats</span></h1>
  <div class="pills" id="range">
    <button data-v="day">Day</button><button data-v="week">Week</button><button data-v="month">Month</button><button data-v="ytd">YTD</button><button data-v="7d">7d</button><button data-v="30d">30d</button><button data-v="90d">90d</button><button data-v="12m">12m</button><button data-v="custom">Custom</button>
  </div>
  <div class="pills" id="platform">
    <button data-v="all">All</button><button data-v="web">Web</button><button data-v="ios">iOS</button><button data-v="android">Android</button>
  </div>
  <button class="btn" id="import" title="Re-run the store imports now">↻ Store import</button>
  <a class="btn" href="/admin/logout">Sign out</a>
</header>
<div class="period" id="period">
  <span id="step"><button class="btn" id="prev" title="Previous">◀</button><input type="date" id="at" aria-label="Date"><button class="btn" id="next" title="Next">▶</button><button class="btn" id="now">Today</button></span>
  <span id="custom"><input type="date" id="from" aria-label="From"> → <input type="date" id="to" aria-label="To"><button class="btn" id="apply">Apply</button></span>
  <div class="pills" id="traffic" title="Real leaves out bots, visitors who never interacted, store review, test devices and the team">
    <button data-v="human">Real</button><button data-v="all">All traffic</button>
  </div>
  <div class="pills" id="bucket" title="Group the charts and the activity table">
    <button data-v="day">By day</button><button data-v="week">By week</button><button data-v="month">By month</button>
  </div>
</div>
<div class="meta" id="meta">Loading…</div>
<div id="root"></div>
</div>
<div id="tip" role="tooltip"></div>
<script>
(function () {
  "use strict";
  var V = (${viewHelpers.toString()})();
  var PCOL = V.PCOL, PNAME = V.PNAME, esc = V.esc, fmt = V.fmt, delta = V.delta, dot = V.dot, lineChart = V.lineChart, periodLabel = V.periodLabel;
  var RANGES = ["day", "week", "month", "ytd", "7d", "30d", "90d", "12m", "custom"];
  // at = anchor day for day/week/month (null = today); from/to = custom period;
  // bucket "" = whatever the server picks for the period.
  var state = { range: "7d", platform: "all", traffic: "human", bucket: "", at: null, from: null, to: null };
  try {
    var saved = JSON.parse(localStorage.getItem("lala-stats") || "{}");
    if (saved.range === "today") saved.range = "day";
    if (RANGES.indexOf(saved.range) >= 0) state.range = saved.range;
    if (saved.platform) state.platform = saved.platform;
    if (saved.traffic === "all") state.traffic = "all";
    if (saved.from && saved.to) { state.from = saved.from; state.to = saved.to; }
  } catch (e) {}
  var lastData = null;

  function pct(x, d) { return x == null ? "—" : (x * 100).toFixed(d == null ? 0 : d) + "%"; }
  function delta(cur, prev) {
    if (!prev) return cur ? '<span class="muted">new</span>' : "";
    var d = (cur - prev) / prev;
    return '<span class="' + (d >= 0 ? "up" : "down") + '">' + (d >= 0 ? "▲" : "▼") + " " + Math.abs(d * 100).toFixed(0) + "%</span> vs prev";
  }
  function stars(n) { var r = Math.round(n || 0); return '<span class="stars">' + "★★★★★".slice(0, r) + '<span class="muted">' + "★★★★★".slice(r) + "</span></span>"; }
  function tile(k, v, s, tight) { return '<div class="tile"><div class="k">' + k + '</div><div class="v' + (tight ? " tight" : "") + '">' + v + '</div><div class="s">' + (s || "&nbsp;") + "</div></div>"; }
  function card(title, body, sub, wide) { return '<div class="card' + (wide ? " wide" : "") + '"><h2>' + title + (sub ? " <small>" + sub + "</small>" : "") + "</h2>" + body + "</div>"; }
  function table(cols, rows, empty) {
    if (!rows.length) return '<p class="muted">' + (empty || "No data yet.") + "</p>";
    return '<div class="tw"><table><tr>' + cols.map(function (c) { return '<th class="' + (c.n ? "n" : "") + '">' + c.h + "</th>"; }).join("") + "</tr>" +
      rows.map(function (r) { return "<tr>" + cols.map(function (c) { return '<td class="' + (c.n ? "n" : "") + '">' + c.f(r) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>";
  }
  function legend(keys) { return '<div class="legend">' + keys.map(function (k) { return '<span><i class="dot" style="background:' + PCOL[k] + '"></i>' + PNAME[k] + "</span>"; }).join("") + "</div>"; }

  // Every section says what it measures.
  function section(title, note) { return '<h2 class="sec">' + title + '</h2><p class="secnote">' + note + "</p>"; }

  function keysIn(points) {
    var seen = {};
    points.forEach(function (p) { Object.keys(p).forEach(function (k) { if (PCOL[k] && p[k]) seen[k] = 1; }); });
    return ["web", "ios", "android", "app"].filter(function (k) { return seen[k]; });
  }
  function bars(points, keys, bucket) {
    return keys.length ? V.stacked(points, keys, bucket) + legend(keys) : '<p class="muted">Nothing in this range yet.</p>';
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

  var TRAFFIC = {
    unengaged: ["Left without interacting", "web visits with no tap, scroll, key or drawing — link scanners and one-glance bounces"],
    bot: ["Bots", "crawlers, link previews, headless / automated browsers"],
    review: ["Store review", "Apple App Review, recognised by Apple's network"],
    test: ["Test devices", "Firebase Test Lab and the Play pre-launch report, recognised by Google's published ranges"],
    internal: ["Internal", "browsers signed into this dashboard, scripts, test & emulator app builds"],
  };
  var BUCKET_HEAD = { day: "Day", week: "Week starting", month: "Month" };
  // Columns of the activity table for the selected platform.
  function dailyCols(p, bucket) {
    var all = [
      { k: "day", h: BUCKET_HEAD[bucket] }, { k: "users", h: "Active users" },
      { k: "web", h: "Web", only: "all" }, { k: "ios", h: "iOS", only: "all" }, { k: "android", h: "Android", only: "all" },
      { k: "newUsers", h: "New users" }, { k: "pageViews", h: "Page views", not: ["ios", "android"] },
      { k: "screenViews", h: "App screens", not: ["web"] }, { k: "drawings", h: "Drawings" }, { k: "failed", h: "Failed" },
      { k: "completed", h: "Completed" }, { k: "downloads", h: "Downloads", not: ["web"] }];
    return all.filter(function (c) { return (!c.only || c.only === p) && (!c.not || c.not.indexOf(p) < 0); });
  }
  function downloadCsv() {
    if (!lastData) return;
    var cols = dailyCols(lastData.platform, lastData.bucket);
    // Untracked usage numbers stay empty: unknown, not 0.
    var lines = [cols.map(function (c) { return c.h; }).join(",")].concat(lastData.daily.map(function (r) {
      return cols.map(function (c) { return r[c.k] == null ? "" : r[c.k]; }).join(",");
    }));
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join(String.fromCharCode(10))], { type: "text/csv" }));
    a.download = "lalabuba-activity-" + lastData.bucket + "-" + lastData.traffic + "-" + lastData.platform + "-" + lastData.from + "_" + lastData.to + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  function render(d) {
    lastData = d;
    var k = d.kpis.cur, kp = d.kpis.prev, st = d.store, rv = st.reviews, h = d.health;
    var dlIos = st.downloads.ios || 0, dlAnd = st.downloads.android || 0;
    var feeds = V.feedStates(h.imports);
    // A platform with no downloads source shows "—" (unknown), never 0.
    var dlKnown = { ios: st.downloads.ios != null || feeds.asc_sales === "ok",
      android: st.downloads.android != null || feeds.play_reports === "ok" || feeds.play_listing === "ok" };
    var dlTxt = function (p, n) { return dlKnown[p] ? fmt(n) : "— (not connected)"; };
    var dlPrev = (st.prevDownloads.ios || 0) + (st.prevDownloads.android || 0);
    var failRate = (k.drawings + k.failed) ? k.failed / (k.drawings + k.failed) : null;
    var html = [];
    // Usage before tracking started is unknown, so it never prints as 0.
    var used = function (n) { return d.tracked ? fmt(n) : "—"; };
    var change = function (cur, prev) { return d.tracked ? delta(cur, prev, d.prevTracked) : ""; };
    var dots = function (parts) { return parts.filter(Boolean).join(" · "); };
    var since = d.trackingSince ? d.trackingSince.slice(0, 10) : null;
    var left = (h.traffic || []).filter(function (r) { return r.traffic !== "human"; });

    html.push(d.traffic === "human"
      ? '<div class="note">Real users only.' + (left.length ? " Left out of this period: " + left.map(function (r) {
          var parts = [];
          if (r.visitors) parts.push(fmt(r.visitors) + " visitor-" + (r.visitors === 1 ? "day" : "days"));
          if (r.drawings) parts.push(fmt(r.drawings) + (r.drawings === 1 ? " draw request" : " draw requests"));
          return esc(TRAFFIC[r.traffic] ? TRAFFIC[r.traffic][0] : r.traffic) + " (" + (parts.join(", ") || fmt(r.events) + " events") + ")";
        }).join(", ") + "." : " Nothing was left out of this period.") + ' <a data-traffic="all">Show all traffic</a></div>'
      : '<div class="note">All traffic: bots, visitors who never interacted, store review, test devices and the team are counted too. <a data-traffic="human">Show real users only</a></div>');
    if (d.unsplit && d.unsplit.drawings) {
      html.push('<div class="note">' + fmt(d.unsplit.drawings) + (d.unsplit.drawings === 1 ? " drawing" : " drawings") + " by " + fmt(d.unsplit.users) +
        (d.unsplit.users === 1 ? " person" : " people") + " came from store app builds older than 1.0.24, which do not say whether they run on iOS or Android, so they are not in this view. " +
        '<a data-platform="all">Show all platforms</a></div>');
    }
    if (!d.tracked || !d.prevTracked || d.daily.some(function (r) { return !r.tracked; })) {
      html.push('<div class="note">' + (since ? "Usage tracking started on " + esc(since) + ": anything earlier is unknown and shows —, not 0." + (d.prevTracked ? "" : " The comparison period predates tracking, so no change is shown.")
        : "Nothing recorded yet.") + "</div>");
    }

    html.push('<div class="tiles">' +
      tile("Active users", used(k.activeUsers), d.tracked ? dots(["≈ " + (k.avgDailyUsers < 10 ? k.avgDailyUsers.toFixed(1) : fmt(Math.round(k.avgDailyUsers))) + "/day", change(k.activeUsers, kp.activeUsers)]) : "") +
      tile("New users", used(k.newUsers), d.tracked ? dots(["new installs / IDs", change(k.newUsers, kp.newUsers)]) : "") +
      tile("Drawings", used(k.drawings), dots([failRate == null ? "" : '<span class="' + (failRate > 0.05 ? "bad" : "") + '">' + pct(failRate, 1) + " failed</span>", change(k.drawings, kp.drawings)])) +
      tile("Completed", used(k.completed), dots([k.drawings ? pct(k.completed / k.drawings) + " of drawings" : "", change(k.completed, kp.completed)])) +
      (d.platform === "web" ? "" : tile("Downloads", dlKnown.ios || dlKnown.android ? fmt(dlIos + dlAnd) : "—", ["iOS " + dlTxt("ios", dlIos), "Android " + dlTxt("android", dlAnd), delta(dlIos + dlAnd, dlPrev)].filter(Boolean).join(" · "))) +
      (rv && rv.perPlatform.android && rv.perPlatform.android.installsTotal != null ? tile("Google Play installs", fmt(rv.perPlatform.android.installsTotal), "lifetime, all countries") : "") +
      (d.edge && d.edge.days.length ? tile("Site visitors", fmt(Math.round(d.edge.totals.uniquesPerDay)) + "/day", fmt(d.edge.totals.pageviews) + " page views · Cloudflare") : "") +
      (rv ? Object.keys(rv.perPlatform).map(function (p) {
        var t = rv.perPlatform[p], gained = t.ratingsAtStart == null ? null : t.ratings - t.ratingsAtStart;
        return tile(p === "ios" ? "App Store rating" : "Google Play rating", t.avg ? t.avg.toFixed(2) + " ★" : "—",
          fmt(t.ratings) + (t.ratingsIsWrittenOnly ? " written reviews" : " ratings") + (gained ? ' · <span class="up">+' + fmt(gained) + "</span> in range" : ""));
      }).join("") + (Object.keys(rv.perPlatform).length > 1 ? tile("Store ratings total", fmt(rv.total), rv.avg ? stars(rv.avg) + " " + rv.avg.toFixed(2) + " weighted" : "no ratings yet") : "") : "") +
      tile("Site rating", d.feedback.site.avg ? d.feedback.site.avg.toFixed(2) + " ★" : "—",
        fmt(d.feedback.site.n) + " ratings" + (d.feedback.pictures.n ? " · pictures " + pct(d.feedback.pictures.loved / d.feedback.pictures.n) + " 😍" : "")) +
      tile("Retention", pct(d.retention.d1) + " / " + pct(d.retention.d7) + " / " + pct(d.retention.d30),
        "D1 / D7 / D30 · cohorts " + fmt(d.retention.d1Base) + " / " + fmt(d.retention.d7Base) + " / " + fmt(d.retention.d30Base), true) +
      tile("Stickiness", pct(d.stickiness.dauMau), "daily ÷ monthly users, 30 days to period end · " + fmt(d.stickiness.mau) + (d.stickiness.mau === 1 ? " install" : " installs")) +
      "</div>");

    // App Store & Google Play ratings
    if (rv) {
      var maxH = 1;
      Object.keys(rv.perPlatform).forEach(function (p) { var hh = rv.perPlatform[p].histogram || {}; Object.keys(hh).forEach(function (k) { if (hh[k] > maxH) maxH = hh[k]; }); });
      var storeCards = Object.keys(rv.perPlatform).map(function (p) {
        var t = rv.perPlatform[p], hh = t.histogram || {};
        var gained = t.ratingsAtStart == null ? null : t.ratings - t.ratingsAtStart;
        var avgMove = t.avgAtStart != null && t.avg != null ? t.avg - t.avgAtStart : null;
        var histRows = [5, 4, 3, 2, 1].map(function (st) {
          var v = hh[st] || 0;
          return '<tr><td class="nw">' + st + ' <span class="stars">★</span></td><td style="width:70%"><div class="bar" style="width:' + (100 * v / maxH).toFixed(1) + '%;background:#f5a623"></div></td><td class="n">' + fmt(v) + "</td></tr>";
        }).join("");
        // No distribution source → say why instead of drawing a misleading all-zero histogram.
        var note = t.histogramSource ? "" : p === "android"
          ? '<p class="muted" style="margin-top:6px">Google Play shows no public rating yet — it appears once enough people have rated the app.</p>'
          : '<p class="muted" style="margin-top:6px">' + V.iosHistogramNote(feeds) + "</p>";
        if (!t.histogramSource) histRows = "";
        return card((p === "ios" ? "App Store" : "Google Play"),
          '<p><span class="big">' + (t.avg ? t.avg.toFixed(2) : "—") + "</span> " + (t.avg ? stars(t.avg) : "") + "</p>" +
          '<p class="muted" style="margin-bottom:8px">' + fmt(t.ratings) + (t.ratingsIsWrittenOnly ? " written reviews" : " ratings") +
          (gained != null ? " · " + (gained > 0 ? '<span class="up">+' + fmt(gained) + "</span>" : "±0") + " in range" : "") +
          (avgMove ? " · avg " + (avgMove > 0 ? '<span class="up">▲' : '<span class="down">▼') + Math.abs(avgMove).toFixed(2) + "</span>" : "") +
          " · " + fmt(t.written) + " written (" + fmt(t.writtenPeriod) + " new)" +
          (t.repliedKnown ? " · replied " + fmt(t.replied) + "/" + fmt(t.repliedKnown) : "") +
          (t.installsTotal != null ? " · " + fmt(t.installsTotal) + " installs" : "") +
          (t.activeDevices != null ? " · " + fmt(t.activeDevices) + " active devices" : "") + "</p>" +
          (histRows ? "<table>" + histRows + "</table>" : "") +
          (t.histogramSource ? '<p class="muted" style="font-size:.75rem;margin-top:4px">distribution: ' + esc(t.histogramSource) + "</p>" : "") + note,
          p === "ios" ? "all 173 storefronts" : "public Play listing");
      }).join("");
      var trendSeries = [];
      if (rv.perPlatform.ios) trendSeries.push({ key: "ios_count", color: "var(--ios)", name: "App Store ratings" });
      if (rv.perPlatform.android) trendSeries.push({ key: "android_count", color: "var(--android)", name: "Google Play ratings" });
      var avgSeries = trendSeries.map(function (x) { return { key: x.key.replace("_count", "_avg"), color: x.color, name: x.name.replace("ratings", "average") }; });
      var recentRv = rv.recent.length ? rv.recent.map(function (r) {
        return '<div class="review">' + dot(r.platform) + stars(r.rating) + ' <span class="muted">' + esc(String(r.created_at).slice(0, 10)) + " " + esc(r.territory || r.lang || "") + (r.app_version ? " v" + esc(r.app_version) : "") + "</span> " +
          (r.replied === true ? '<span class="badge ok">replied</span>' : r.replied === false ? '<span class="badge">no reply</span>' : "") +
          (r.title ? "<br><b>" + esc(r.title) + "</b>" : "") + (r.body ? "<br>" + esc(r.body) : "") + "</div>";
      }).join("") : '<p class="muted">' + V.noReviewsNote(feeds, Object.keys(rv.perPlatform)) + "</p>";
      html.push(section("⭐ App Store &amp; Google Play ratings", "What the stores publish, imported nightly. Store numbers are not filtered by the Real / All traffic switch.") + '<div class="grid">' + storeCards +
        card("Rating count over time", lineChart(rv.trend, trendSeries, { total: true }) + legend(Object.keys(rv.perPlatform)), "daily snapshot") +
        card("Average over time", lineChart(rv.trend, avgSeries, { fmtY: function (v) { return Number(v).toFixed(2); } }) + legend(Object.keys(rv.perPlatform))) +
        (rv.iosCountries.length ? card("App Store ratings by country", hbars(rv.iosCountries, function (r) { return esc(r.country); }, function (r) { return r.n; })) : "") +
        card("Latest written reviews", '<div class="scroll">' + recentRv + "</div>") +
        "</div>");
    }

    var who = d.traffic === "human" ? "people only" : "all traffic";
    html.push(section("👥 Users &amp; activity", "First-party events and drawings" + (since ? ", tracked since " + esc(since) : "") + ". Installs count once per " + d.bucket + "; anonymous web visitors get a new ID every day, so a week or month counts them once per day."));
    var ak = keysIn(d.series.activeUsers), dk = keysIn(d.series.drawings), sk = keysIn(d.series.downloads);
    var fails = d.series.drawings.reduce(function (a, p) { return a + p._fail; }, 0);
    html.push('<div class="grid">' +
      card("Active users per " + d.bucket, bars(d.series.activeUsers, ak, d.bucket), who) +
      card("Drawings per " + d.bucket, bars(d.series.drawings, dk, d.bucket), fmt(fails) + " failed in range") +
      (d.platform === "web" ? "" : card("Downloads per " + d.bucket, bars(d.series.downloads, sk, d.bucket), "App Store + Google Play")) +
      "</div>");
    html.push('<div class="card full">' +
      '<h2>User activity by ' + d.bucket + ' <small>' + esc(d.from) + " → " + esc(d.to) + " · " + who + ', newest first</small> <button class="btn" id="csv" style="margin-left:auto;font-size:.78rem;padding:3px 8px">⬇ CSV</button></h2>' +
      '<div class="xscroll">' + table(dailyCols(d.platform, d.bucket).map(function (c) {
        return { h: c.h, n: c.k !== "day", f: c.k === "day" ? function (r) { return '<span class="nw">' + esc(periodLabel(r.day, d.bucket)) + "</span>"; }
          : function (r) { return r[c.k] == null ? '<span class="muted">—</span>' : r[c.k] ? fmt(r[c.k]) : '<span class="muted">0</span>'; } };
      }), d.daily, "No days in range.").replace(/<tr><td class="">(<span class="nw">(Sat|Sun))/g, '<tr class="we"><td class="">$1') + "</div></div>");

    // Website traffic — Cloudflare edge (everyone, incl. bots and pre-tracking history)
    if (d.edge) {
      var tr = d.edge;
      var trBody = tr.days.length
        ? '<div class="grid">' +
            card("Visitors &amp; page views per day", lineChart(tr.days, [
              { key: "uniques", color: "var(--web)", name: "Unique visitors" },
              { key: "pageviews", color: "var(--ios)", name: "Page views" }]) +
              '<div class="legend"><span><i class="dot" style="background:var(--web)"></i>Unique visitors</span><span><i class="dot" style="background:var(--ios)"></i>Page views</span></div>', "Cloudflare edge — includes bots") +
            card("Edge totals", '<table>' +
              "<tr><td>Requests</td><td class=\\"n\\">" + fmt(tr.totals.requests) + "</td></tr>" +
              "<tr><td>Served from cache</td><td class=\\"n\\">" + (tr.totals.requests ? pct(tr.totals.cached / tr.totals.requests) : "—") + "</td></tr>" +
              "<tr><td>Page views</td><td class=\\"n\\">" + fmt(tr.totals.pageviews) + "</td></tr>" +
              "<tr><td>Unique visitors / day</td><td class=\\"n\\">" + fmt(Math.round(tr.totals.uniquesPerDay || 0)) + "</td></tr>" +
              "<tr><td>Threats blocked</td><td class=\\"n\\">" + fmt(tr.totals.threats) + "</td></tr></table>" +
              '<p class="muted" style="margin-top:8px;font-size:.78rem">First-party numbers above count real visitors only; this counts every request Cloudflare saw.</p>') +
            card("Countries", hbars(tr.countries, function (r) { return esc(r.country); }, function (r) { return r.n; }), "requests") +
          "</div>"
        : '<div class="card"><p class="muted">' + V.noEdgeNote(feeds) + "</p></div>";
      html.push(section("🌐 Website traffic", "Every request Cloudflare saw at the edge, bots included, so the Real / All traffic switch does not change it.") + trBody);
    }

    // Prompts
    html.push(section("🎨 What people draw", "Subjects of successful drawings in the period. Raw typed text is deleted after 30 days."));
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
      { h: "", f: function (r) { return dot(r.platform) + esc(r.lang || "") + (r.outcome !== "ok" ? ' <span class="bad">' + esc(r.outcome) + "</span>" : ""); } },
    ], d.prompts.latestTyped, "No typed prompts in the last 30 days.");
    html.push('<div class="grid">' +
      card("Top prompts", '<div class="scroll">' + top + "</div>", "successful drawings, English subject") +
      card("Where prompts come from", hbars(d.prompts.bySource, function (r) { return esc(r.source); }, function (r) { return Number(r.n); }) +
        '<details><summary>Latest 50 typed prompts</summary><div class="scroll">' + typed + "</div></details>", "raw text kept 30 days") +
      "</div>");

    // Usage
    html.push(section("📱 Screens, pages &amp; actions", "Core actions come from the server's drawing log: every request by where it started, latency for successful ones. Screens, pages and actions are events sent by the apps and the site."));
    var core = d.usage.core, hasApp = core.some(function (r) { return r.app; });
    var secs = function (v) { return v == null ? "—" : (v / 1000).toFixed(1) + "s"; };
    var coreCols = [
      { h: "Drawing started from", f: function (r) { return r.source == null ? "<b>All</b>" : esc(r.source.replace(/_/g, " ")); } },
      { h: "Total", n: 1, f: function (r) { return fmt(r.n); } },
      { h: "OK", n: 1, f: function (r) { return pct(r.ok / r.n); } },
      { h: "Failed", n: 1, f: function (r) { return r.fail ? '<span class="bad">' + fmt(r.fail) + "</span>" : "0"; } },
      { h: "Rejected", n: 1, f: function (r) { return fmt(r.rejected); } },
      { h: "p50", n: 1, f: function (r) { return secs(r.p50); } },
      { h: "p95", n: 1, f: function (r) { return secs(r.p95); } },
      { h: "Web", n: 1, f: function (r) { return fmt(r.web); } },
      { h: "iOS", n: 1, f: function (r) { return fmt(r.ios); } },
      { h: "Android", n: 1, f: function (r) { return fmt(r.android); } }];
    if (hasApp) coreCols.push({ h: "App (old)", n: 1, f: function (r) { return fmt(r.app); } });
    var actions = Object.keys(d.usage.actions).sort(function (a, b) { return d.usage.actions[b].total - d.usage.actions[a].total; }).map(function (e) { var a = d.usage.actions[e]; return { e: e, a: a }; });
    html.push('<div class="grid">' +
      card("Core actions", table(coreCols, core, "No drawings in this range."), "rejected = bot check, safety filter, limits", true) +
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

    // User journeys: one row per install, a click opens its timeline.
    html.push(section("🧭 User journeys", "Each anonymous install active in the period, newest first (up to 100). Click one to see everything it did, in order. Store builds older than 1.0.24 send drawings only; screens and actions need 1.0.24+. Website visitors without an install ID change their ID daily and cannot be followed."));
    var when = function (t) { return t ? esc(String(t).slice(0, 16).replace("T", " ")) : "—"; };
    html.push('<div class="grid">' + card("Installs", '<div class="jr">' + table([
      { h: "Install", f: function (r) { return '<a data-journey="' + esc(r.id) + '">' + esc(r.id.slice(0, 8)) + "…</a>"; } },
      { h: "Platform", f: function (r) { return dot(r.platform) + esc(PNAME[r.platform] || r.platform); } },
      { h: "Version", f: function (r) { return esc(r.version || (r.platform === "app" ? "≤1.0.23" : "—")); } },
      { h: "Country", f: function (r) { return esc(r.country || "—"); } },
      { h: "First seen", f: function (r) { return when(r.first_seen); } },
      { h: "Last active", f: function (r) { return when(r.last); } },
      { h: "Days", n: 1, f: function (r) { return fmt(r.days); } },
      { h: "Opens", n: 1, f: function (r) { return fmt(r.opens); } },
      { h: "Screens", n: 1, f: function (r) { return fmt(r.screens); } },
      { h: "Drawings", n: 1, f: function (r) { return fmt(r.drawings); } },
      { h: "Refused", n: 1, f: function (r) { return r.refused ? '<span class="bad">' + fmt(r.refused) + "</span>" : "0"; } },
      { h: "Finished", n: 1, f: function (r) { return fmt(r.completed); } },
      { h: "Saved / shared", n: 1, f: function (r) { return fmt(r.kept); } }], d.journeys || [], "No installs active in this range.") + "</div>",
      "UTC times", true) + '<div class="card wide" id="journey" hidden></div></div>');

    // Acquisition
    html.push(section("📣 Where users come from\", "Visits by referrer or UTM, first touch of new installs, challenge links, and the stores' own download sources."));
    var ac = d.acquisition;
    html.push('<div class="grid">' +
      card("Visit sources", table([
        { h: "Source", f: function (r) { return esc(r.source) + (r.medium ? ' <span class="muted">' + esc(r.medium) + "</span>" : ""); } },
        { h: "Campaign", f: function (r) { return esc(r.campaign || ""); } },
        { h: "Visits", n: 1, f: function (r) { return fmt(r.n); } }], ac.visits, "No referred visits yet."), "referrer domain / UTM") +
      card("New users by source", table([
        { h: "", f: function (r) { return dot(r.platform); } },
        { h: "Source", f: function (r) { return esc(r.source) + (r.campaign ? ' <span class="muted">' + esc(r.campaign) + "</span>" : ""); } },
        { h: "Users", n: 1, f: function (r) { return fmt(r.n); } }], ac.installs), "first touch; Android via Play Install Referrer") +
      card("Challenge links", '<div class="tiles" style="grid-template-columns:repeat(3,1fr);margin:0">' +
        tile("Created", fmt(ac.challenge.created)) + tile("Opened", fmt(ac.challenge.opened)) + tile("New users", fmt(ac.challenge.newUsers)) + "</div>") +
      (d.platform === "web" ? "" : card("Store sources", table([
        { h: "", f: function (r) { return dot(r.platform); } },
        { h: "Source / campaign", f: function (r) { return esc(r.metric.replace(/^src:/, "").replace(/^cmp:/, "campaign: ").replace(/^ref:/, "referrer: ")); } },
        { h: "Downloads", n: 1, f: function (r) { return fmt(r.n); } }], ac.store, V.noStoreSourcesNote(feeds)), "App Store Analytics · Play acquisition")) +
      "</div>");

    // Feedback & ratings
    var fb = d.feedback, site = fb.site, pics = fb.pictures;
    var maxDist = Math.max.apply(null, site.distribution.map(function (x) { return x.n; })) || 1;
    var dist = site.distribution.slice().reverse().map(function (x) {
      return '<tr><td class="nw">' + x.rating + ' <span class="stars">★</span></td><td style="width:70%"><div class="bar" style="width:' + (100 * x.n / maxDist).toFixed(1) + '%;background:#f5a623"></div></td><td class="n">' + fmt(x.n) + "</td></tr>";
    }).join("");
    var siteBody = site.n
      ? '<p style="margin-bottom:6px"><b style="font-size:1.4rem">' + site.avg.toFixed(2) + "</b> " + stars(site.avg) + ' <span class="muted">' + fmt(site.n) + " ratings" +
        (site.prevN ? " · prev " + (site.prevAvg ? site.prevAvg.toFixed(2) + " ★ (" + fmt(site.prevN) + ")" : "—") : "") +
        " · web " + fmt(site.byPlatform.web) + " · iOS " + fmt(site.byPlatform.ios) + " · Android " + fmt(site.byPlatform.android) + "</span></p><table>" + dist + "</table>"
      : '<p class="muted">No site ratings in this range yet. Grown-ups rate via "⭐ Rate Lalabuba" (web footer) and Settings → Send feedback (apps).</p>';
    var comments = site.comments.length ? site.comments.map(function (c) {
      return '<div class="review">' + dot(c.platform) + stars(c.rating) + ' <span class="muted">' + esc(String(c.ts).slice(0, 10)) + " " + esc(c.country || "") + " " + esc(c.lang || "") + "</span><br>" + esc(c.comment) + "</div>";
    }).join("") : '<p class="muted">No comments in this range.</p>';
    var face = function (avg) { return avg == null ? "—" : (avg >= 2.5 ? "😍 " : avg >= 1.75 ? "🙂 " : "😕 ") + avg.toFixed(2); };
    var picBody = pics.n
      ? '<div class="tiles" style="grid-template-columns:repeat(3,1fr);margin:0 0 8px">' +
          tile("😍 loved", pct(pics.loved / pics.n), fmt(pics.loved)) + tile("🙂 ok", pct(pics.ok / pics.n), fmt(pics.ok)) + tile("😕 not really", pct(pics.meh / pics.n), fmt(pics.meh)) + "</div>" +
        table([{ h: "Provider", f: function (r) { return esc(r.key); } }, { h: "Ratings", n: 1, f: function (r) { return fmt(r.n); } }, { h: "Avg (1–3)", n: 1, f: function (r) { return face(r.avg); } }], pics.byProvider) +
        table([{ h: "Difficulty", f: function (r) { return esc(r.key); } }, { h: "Ratings", n: 1, f: function (r) { return fmt(r.n); } }, { h: "Avg (1–3)", n: 1, f: function (r) { return face(r.avg); } }], pics.byDifficulty) +
        "<details><summary>Lowest-rated subjects (≥2 ratings)</summary>" + table([{ h: "Subject", f: function (r) { return esc(r.subject); } }, { h: "Ratings", n: 1, f: function (r) { return fmt(r.n); } }, { h: "Avg", n: 1, f: function (r) { return face(r.avg); } }], pics.lowestSubjects) + "</details>"
      : '<p class="muted">No picture ratings in this range yet (asked in the completion celebration).</p>';
    var rr = fb.reroll;
    var signals = '<table>' +
      '<tr><td>Re-roll rate <span class="muted">(🎲 Again ÷ drawings)</span></td><td class="n">' + (rr.drawings ? pct(rr.again / rr.drawings) : "—") + ' <span class="muted">' + fmt(rr.again) + "/" + fmt(rr.drawings) + "</span></td></tr>" +
      '<tr><td>Content reports 🚩</td><td class="n">' + fmt(fb.contentReports.reduce(function (a, r) { return a + r.n; }, 0)) + ' <span class="muted">' + fb.contentReports.map(function (r) { return esc(r.reason) + " " + r.n; }).join(" · ") + "</span></td></tr>" +
      '<tr><td>Contact messages</td><td class="n">' + fmt(fb.contact.n) + "</td></tr>" +
      '<tr><td>Store review prompts shown → store opened</td><td class="n">' + fmt(fb.reviewPrompts.shown) + " → " + fmt(fb.reviewPrompts.storeOpened) + "</td></tr>" +
      '<tr><td>Feedback form opened</td><td class="n">' + fmt(fb.reviewPrompts.feedbackOpened) + "</td></tr></table>" +
      (fb.contact.latest.length ? "<details><summary>Latest contact messages</summary>" + fb.contact.latest.map(function (c) {
        return '<div class="review"><span class="muted">' + esc(String(c.ts).slice(0, 10)) + " " + esc(c.platform) + " " + esc(c.country || "") + "</span><br>" + esc(c.comment) + "</div>";
      }).join("") + "</details>" : "");
    html.push(section("💬 In-app feedback &amp; ratings", "What people told us directly. Ratings and messages carry no traffic class, so the Real / All traffic switch does not change them; the re-roll rate and review prompts do follow it.") + '<div class="grid">' +
      card("Site rating", siteBody, "grown-ups, 1–5 ★") +
      card("Feedback comments", '<div class="scroll">' + comments + "</div>") +
      card("Picture ratings", picBody, "kids, after finishing a picture") +
      card("Other signals", signals) +
      "</div>");

    // App quality — Android vitals (Play Developer Reporting API)
    if (d.vitals) {
      var vt = d.vitals, lv = vt.latest, rate = function (v) { return v == null ? "—" : (v * 100).toFixed(2) + "%"; };
      var flag = function (v, lim) { return v == null ? "" : v > lim ? '<span class="bad">above Play\\'s bad-behaviour line (' + rate(lim) + ")</span>" : '<span class="ok">under Play\\'s ' + rate(lim) + " line</span>"; };
      html.push(section("🛠 App quality (Android vitals)", "Google's crash and ANR rates from Play, over the last 30 days. Not filtered by the Real / All traffic switch.") + (vt.days.length
        ? '<div class="tiles">' +
            tile("User-perceived crash rate", rate(lv.crash_rate_user), flag(lv.crash_rate_user, vt.thresholds.crash_rate_user)) +
            tile("User-perceived ANR rate", rate(lv.anr_rate_user), flag(lv.anr_rate_user, vt.thresholds.anr_rate_user)) +
            tile("Crash rate (all)", rate(lv.crash_rate), "ANR " + rate(lv.anr_rate)) +
            tile("Users measured", fmt(lv.vitals_users), "latest day " + esc(lv.day)) +
          '</div><div class="grid">' + card("Crash &amp; ANR rate per day", lineChart(vt.days, [
              { key: "crash_rate_user", color: "var(--bad)", name: "Crash rate" },
              { key: "anr_rate_user", color: "#f5a623", name: "ANR rate" }], { fmtY: rate }) +
              '<div class="legend"><span><i class="dot" style="background:var(--bad)"></i>Crash (user-perceived)</span><span><i class="dot" style="background:#f5a623"></i>ANR (user-perceived)</span></div>', "last 30 days, Play Console data") + "</div>"
        : '<div class="card"><p class="muted">' + V.noVitalsNote(feeds) + "</p></div>"));
    }

    // Safety: what the filter refused, and reports waiting for a person.
    var sf = h.safety || { byStage: [], recent: [], openReports: [] };
    html.push(section("\uD83D\uDEE1 Safety", "What the child-safety filter refused in the period (original words, translated text or finished picture) and the in-app reports waiting for a person. Pictures stay hidden until you open them. Normal subjects appearing here mean it is over-blocking."));
    html.push('<div class="grid">' +
      card("Refused", table([
        { h: "Stage", f: function (r) { return esc(r.stage); } },
        { h: "Why", f: function (r) { return esc(r.category); } },
        { h: "Count", n: 1, f: function (r) { return fmt(r.n); } }], sf.byStage, "Nothing refused in this period.")) +
      card("Latest refusals", table([
        { h: "When", f: function (r) { return esc(String(r.ts).slice(5, 16).replace("T", " ")); } },
        { h: "Stage", f: function (r) { return esc(r.stage) + " \u00B7 " + esc(r.category); } },
        { h: "Subject", f: function (r) { return esc(r.subject || r.subject_en || "\u2014"); } }], sf.recent, "Nothing refused in this period."), null, true) +
      card("Reports to review (" + fmt(sf.openReports.length) + ")", sf.openReports.length ? sf.openReports.map(function (r) {
        return '<div class="report" data-report-row="' + esc(r.id) + '"><b>#' + esc(r.id) + "</b> " + esc(r.reason) + " \u00B7 " + esc(r.subject) +
          '<div class="muted">' + esc(String(r.created_at).slice(0, 16).replace("T", " ")) + " \u00B7 " + esc(r.source || "\u2014") + " \u00B7 " + esc(r.platform || "\u2014") + " " + esc(r.app_version || "") + "</div>" +
          (r.has_evidence ? '<details><summary>Show picture</summary><img class="report-img" loading="lazy" alt="Reported picture" src="/api/admin/content-reports?evidence=' + esc(r.id) + '"></details>' : '<div class="muted">No picture stored</div>') +
          '<div class="report-actions"><button class="btn" data-report="' + esc(r.id) + '" data-verdict="dismissed">Picture is fine</button> ' +
          '<button class="btn" data-report="' + esc(r.id) + '" data-verdict="actioned">Remove and block subject</button></div></div>';
      }).join("") : '<p class="muted">No reports waiting.</p>', null, true) +
      "</div>");

    // Health
    html.push(section("🩺 Health &amp; imports", "Whether the service works: image providers, request outcomes, the traffic classes in the period and the state of every store feed."));
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
      card(d.traffic === "human" ? "Not counted" : "Traffic classes", table([
        { h: "Traffic", f: function (r) { return "<b>" + esc(TRAFFIC[r.traffic] ? TRAFFIC[r.traffic][0] : r.traffic) + '</b><br><span class="muted">' + esc(TRAFFIC[r.traffic] ? TRAFFIC[r.traffic][1] : "") + "</span>"; } },
        { h: "Visitor-days", n: 1, f: function (r) { return fmt(r.visitors); } },
        { h: "Events", n: 1, f: function (r) { return fmt(r.events); } },
        { h: "Draw requests", n: 1, f: function (r) { return fmt(r.drawings); } }],
        d.traffic === "human" ? left : h.traffic || [], "Nothing filtered in this range."), d.traffic === "human" ? "excluded from the people-only numbers" : "all of these are counted above", true) +
      card("Countries", hbars(h.countries, function (r) { return esc(r.country); }, function (r) { return Number(r.users); }), "users") +
      card("Languages", hbars(h.languages, function (r) { return esc(r.lang); }, function (r) { return Number(r.n); }), "drawings") +
      card("App versions", table([
        { h: "", f: function (r) { return dot(r.platform); } },
        { h: "Version", f: function (r) { return esc(r.app_version); } },
        { h: "Installs", n: 1, f: function (r) { return fmt(r.installs); } }], h.versions, "Needs app 1.0.24+.")) +
      card("Store imports", table([
        { h: "Feed", f: function (r) { return '<span style="white-space:nowrap">' + esc(r.source) + "</span>"; } },
        { h: "", f: function (r) { return r.ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'; } },
        { h: "Last run", f: function (r) { return '<span class="muted">' + ago(r.ran_at) + "</span>"; } },
        { h: "Detail", f: function (r) { return '<span class="muted">' + esc(r.detail) + "</span>"; } }], h.imports, "Not run yet — first run ~2 min after deploy, then nightly 04:30 UTC."), "nightly 04:30 UTC", true) +
      "</div>");

    $("root").innerHTML = html.join("");
    Array.prototype.forEach.call(document.querySelectorAll("#bucket button"), function (b) { b.classList.toggle("on", b.dataset.v === d.bucket); });
  }

  // A background refresh must leave the reader where they were.
  function keepingView(draw) {
    var root = $("root"), all = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
    var open = all("details").map(function (x) { return x.open; }), tops = all(".scroll,.xscroll").map(function (x) { return x.scrollTop; });
    draw();
    all("details").forEach(function (x, i) { if (open[i]) x.open = true; });
    all(".scroll,.xscroll").forEach(function (x, i) { if (tops[i]) x.scrollTop = tops[i]; });
  }

  function $(id) { return document.getElementById(id); }
  function todayUtc() { return new Date().toISOString().slice(0, 10); }
  function addDays(s, n) { var t = new Date(s + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function addMonths(s, n) { var t = new Date(s.slice(0, 8) + "01T00:00:00Z"); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); }

  function setPills() {
    ["range", "platform", "traffic"].forEach(function (id) {
      Array.prototype.forEach.call(document.querySelectorAll("#" + id + " button"), function (b) { b.classList.toggle("on", b.dataset.v === state[id]); });
    });
    var stepping = ["day", "week", "month"].indexOf(state.range) >= 0;
    $("step").style.display = stepping ? "" : "none";
    $("custom").style.display = state.range === "custom" ? "" : "none";
    var at = state.at || todayUtc();
    $("at").value = at; $("at").max = todayUtc();
    $("from").max = $("to").max = todayUtc();
    $("from").value = state.from || addDays(todayUtc(), -29); $("to").value = state.to || todayUtc();
    $("next").disabled = !state.at || state.at >= todayUtc();
  }

  function query() {
    var q = "range=" + state.range + "&platform=" + state.platform + "&traffic=" + state.traffic;
    if (state.bucket) q += "&bucket=" + state.bucket;
    if (state.at && ["day", "week", "month"].indexOf(state.range) >= 0) q += "&at=" + state.at;
    if (state.range === "custom") q += "&from=" + ($("from").value || "") + "&to=" + ($("to").value || "");
    return q;
  }

  var latest = 0; // a slower, older response never replaces a newer one
  function load(background) {
    var mine = ++latest;
    setPills();
    try { localStorage.setItem("lala-stats", JSON.stringify({ range: state.range, platform: state.platform, traffic: state.traffic, from: state.from, to: state.to })); } catch (e) {}
    if (!background) $("meta").textContent = "Loading…";
    fetch("/api/admin/stats?" + query(), { credentials: "same-origin" })
      .then(function (r) {
        if (r.status === 401) { location.href = "/admin/login"; throw new Error("auth"); }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        if (mine !== latest) return;
        $("meta").textContent = (d.from === d.to ? periodLabel(d.from) : periodLabel(d.from) + " → " + periodLabel(d.to)) + " (UTC) · " + d.days + (d.days === 1 ? " day" : " days") +
          " · compared with " + d.prevFrom + (d.prevFrom === d.prevTo ? "" : " → " + d.prevTo) + " · " + (PNAME[d.platform] || "All platforms") + " · " + (d.traffic === "human" ? "real users" : "all traffic") + " · updated " + new Date(d.generatedAt).toLocaleTimeString();
        if (background) keepingView(function () { render(d); }); else render(d);
      })
      .catch(function (e) {
        if (e.message === "auth" || mine !== latest) return;
        $("meta").textContent = "";
        $("root").innerHTML = '<div class="err">Could not load stats: ' + esc(e.message) + "</div>";
      });
  }

  ["range", "platform", "traffic", "bucket"].forEach(function (id) {
    $(id).addEventListener("click", function (e) {
      var v = e.target.dataset && e.target.dataset.v; if (!v) return;
      if (id === "range" && v !== state.range) { state.at = null; state.bucket = ""; } // the new period picks its own bucket
      state[id] = v; load();
    });
  });
  function step(n) {
    var at = state.at || todayUtc();
    at = state.range === "month" ? addMonths(at, n) : addDays(at, n * (state.range === "week" ? 7 : 1));
    state.at = at >= todayUtc() ? null : at; load();
  }
  $("prev").addEventListener("click", function () { step(-1); });
  $("next").addEventListener("click", function () { step(1); });
  $("now").addEventListener("click", function () { state.at = null; load(); });
  $("at").addEventListener("change", function () { var v = this.value; state.at = v && v < todayUtc() ? v : null; load(); });
  $("apply").addEventListener("click", function () { state.from = $("from").value; state.to = $("to").value; load(); });
  $("root").addEventListener("click", function (e) {
    if (!e.target) return;
    if (e.target.id === "csv") downloadCsv();
    if (e.target.dataset && e.target.dataset.traffic) { state.traffic = e.target.dataset.traffic; load(); }
    if (e.target.dataset && e.target.dataset.platform) { state.platform = e.target.dataset.platform; load(); }
    if (e.target.dataset && e.target.dataset.journey) openJourney(e.target.dataset.journey);
    if (e.target.dataset && e.target.dataset.journeyClose) { $("journey").hidden = true; }
    if (e.target.dataset && e.target.dataset.report) {
      var verdict = e.target.dataset.verdict;
      e.target.disabled = true;
      fetch("/api/admin/content-reports", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(e.target.dataset.report), status: verdict, blockSubject: verdict === "actioned" }) })
        .then(function (r) { if (!r.ok) throw new Error(); load(); })
        .catch(function () { e.target.disabled = false; alert("Could not save that. Please try again."); });
    }
  });
  // ── One install's timeline (GET ?journey=<id>), oldest first, split into sessions.
  var STEP = { app_open: "📱 Opened the app", complete: "✅ Finished a picture", save: "💾 Saved", print: "🖨️ Printed",
    share: "📤 Shared", share_art: "🖼️ Shared art", community_share: "🌍 Shared to community", challenge_create: "🏆 Made a challenge",
    challenge_open: "🏆 Opened a challenge", gallery_open: "🖼️ Opened the gallery", scene_open: "🏞️ Opened a scene",
    journal_open: "📔 Opened the journal", report_content: "🚩 Reported a picture", review_prompt: "⭐ Saw the rating prompt",
    review_store_open: "⭐ Opened the store page", feedback_open: "💬 Opened feedback", engage: "👆 First interaction",
    error: "⚠️ App error" };
  function stepLabel(s) {
    var p = s.props || {};
    if (s.kind === "draw") {
      var subj = p.subject ? " “" + esc(p.subject) + "”" : "";
      var meta = [s.detail, p.difficulty, p.ms != null ? (p.ms / 1000).toFixed(1) + "s" : ""].filter(Boolean).map(esc).join(" · ");
      return (s.what === "ok" ? "🎨 Drew" + subj : '<span class="bad">⛔ Drawing refused (' + esc(s.what) + ")" + subj + "</span>") +
        (meta ? ' <span class="muted">' + meta + "</span>" : "");
    }
    if (s.what === "screen_view") return "👀 " + esc(s.detail || "screen");
    if (s.what === "page_view") return "🌐 " + esc(s.detail || "page");
    var extra = Object.keys(p).filter(function (k) { return !/^acq_/.test(k); }).map(function (k) { return esc(k) + " " + esc(String(p[k])); }).join(" · ");
    return (STEP[s.what] || esc(s.what.replace(/_/g, " "))) + (extra ? ' <span class="muted">' + extra + "</span>" : "");
  }
  function renderJourney(box, j) {
    var steps = j.steps.slice().reverse(), rows = [], prev = null, n = 0;
    steps.forEach(function (s) {
      var t = new Date(s.ts).getTime();
      if (prev == null || t - prev > 30 * 60000) {
        n++;
        rows.push('<tr><td colspan="3"><b>Session ' + n + "</b> · " + esc(String(s.ts).slice(0, 16).replace("T", " ")) + " UTC · " +
          esc(PNAME[s.platform] || s.platform) + (s.app_version ? " " + esc(s.app_version) : "") + (s.traffic !== "human" ? ' · <span class="muted">' + esc(s.traffic) + "</span>" : "") + "</td></tr>");
      }
      rows.push('<tr><td class="muted">' + esc(String(s.ts).slice(11, 16)) + "</td><td>" + (prev == null || t - prev > 30 * 60000 ? "" : "+" + Math.round((t - prev) / 1000) + "s") + "</td><td>" + stepLabel(s) + "</td></tr>");
      prev = t;
    });
    var i = j.install || {};
    box.innerHTML = "<h2>Install " + esc(j.id.slice(0, 8)) + "… <small>" + [i.country, i.first_version, i.acq_source ? "came from " + i.acq_source : "", i.traffic].filter(Boolean).map(esc).join(" · ") +
      '</small> <button class="btn" data-journey-close="1" style="margin-left:auto">Close</button></h2>' +
      (rows.length ? '<div class="tw"><table>' + rows.join("") + "</table></div>" : '<p class="muted">Nothing recorded for this install.</p>') +
      (j.truncated ? '<p class="muted">Showing the latest 500 steps.</p>' : "");
  }
  function openJourney(id) {
    var box = $("journey"); if (!box) return;
    box.hidden = false; box.innerHTML = '<p class="muted">Loading…</p>';
    box.scrollIntoView({ block: "nearest" });
    fetch("/api/admin/stats?journey=" + encodeURIComponent(id), { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { renderJourney(box, j); })
      .catch(function (e) { box.innerHTML = '<p class="bad">Could not load this journey: ' + esc(e.message) + "</p>"; });
  }

  // One tooltip for every chart; a tap shows it on touch screens.
  var tip = $("tip");
  function showTip(e) {
    var t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.style.display = "none"; return; }
    tip.textContent = t.getAttribute("data-tip");
    tip.style.display = "block";
    var x = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8), y = e.clientY - tip.offsetHeight - 10;
    tip.style.transform = "translate(" + Math.max(8, x) + "px," + (y < 8 ? e.clientY + 14 : y) + "px)";
  }
  document.addEventListener("pointermove", showTip);
  document.addEventListener("pointerdown", showTip);
  addEventListener("scroll", function () { tip.style.display = "none"; }, { passive: true });
  document.getElementById("import").addEventListener("click", function () {
    var b = this; b.disabled = true; b.textContent = "Import started…";
    fetch("/api/admin/stats", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import" }) })
      .then(function () { setTimeout(function () { b.disabled = false; b.textContent = "↻ Store import"; load(); }, 20000); });
  });
  load();
  // Auto-refresh, but never while someone is working in a field on the page.
  setInterval(function () {
    var a = document.activeElement;
    if (!document.hidden && !(a && /^(INPUT|SELECT)$/.test(a.tagName))) load(true);
  }, 60 * 1000);
})();
</script>
</body>
</html>`;
}

module.exports = { renderAdminStatsPage };
