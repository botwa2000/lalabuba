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
h2.sec{font-size:1.05rem;font-weight:800;margin:20px 0 10px}
.badge{display:inline-block;font-size:.7rem;font-weight:700;padding:1px 6px;border-radius:6px;background:var(--grid);color:var(--muted)}
.badge.ok{background:rgba(30,158,90,.15);color:var(--good)}
.big{font-size:2rem;font-weight:800;font-variant-numeric:tabular-nums}
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

  function section(title) { return '<h2 class="sec">' + title + "</h2>"; }

  // Daily snapshot lines. rows: [{day, ios_count, android_count, ...}], series: [{key, color, name}]
  function lineChart(rows, series, fmtY) {
    var W = 560, H = 150, padL = 34, padB = 18;
    var vals = [];
    rows.forEach(function (r) { series.forEach(function (s) { if (r[s.key] != null) vals.push(r[s.key]); }); });
    if (!vals.length) return '<p class="muted">No snapshots in this range yet — the store import runs nightly.</p>';
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    if (max === min) { max = max + 1; min = Math.max(0, min - 1); }
    var n = rows.length, x = function (i) { return padL + (n === 1 ? (W - padL) / 2 : i * (W - padL - 10) / (n - 1)); };
    var y = function (v) { return (H - padB) - (v - min) / (max - min) * (H - padB - 8); };
    var out = [];
    [min, (min + max) / 2, max].forEach(function (v) {
      out.push('<line x1="' + padL + '" x2="' + W + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--grid)"/>');
      out.push('<text x="' + (padL - 4) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + (fmtY ? fmtY(v) : fmt(Math.round(v))) + "</text>");
    });
    series.forEach(function (s) {
      var pts = [];
      rows.forEach(function (r, i) { if (r[s.key] != null) pts.push([x(i), y(r[s.key]), r]); });
      if (pts.length > 1) out.push('<polyline fill="none" stroke="' + s.color + '" stroke-width="2" points="' + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>');
      pts.forEach(function (p) { out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="' + s.color + '"><title>' + p[2].day + " " + s.name + ": " + (fmtY ? fmtY(p[2][s.key]) : fmt(p[2][s.key])) + "</title></circle>"); });
    });
    var every = Math.ceil(n / 8);
    rows.forEach(function (r, i) { if (i % every === 0 || n <= 8) out.push('<text x="' + x(i).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + r.day.slice(5) + "</text>"); });
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img">' + out.join("") + "</svg>";
  }

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
      (rv && rv.perPlatform.android && rv.perPlatform.android.installsTotal != null ? tile("Google Play installs", fmt(rv.perPlatform.android.installsTotal), "lifetime, all countries") : "") +
      (d.traffic && d.traffic.days.length ? tile("Site visitors", fmt(Math.round(d.traffic.totals.uniquesPerDay)) + "/day", fmt(d.traffic.totals.pageviews) + " page views · Cloudflare") : "") +
      (rv ? Object.keys(rv.perPlatform).map(function (p) {
        var t = rv.perPlatform[p], gained = t.ratingsAtStart == null ? null : t.ratings - t.ratingsAtStart;
        return tile(p === "ios" ? "App Store rating" : "Google Play rating", t.avg ? t.avg.toFixed(2) + " ★" : "—",
          fmt(t.ratings) + (t.ratingsIsWrittenOnly ? " written reviews" : " ratings") + (gained ? ' · <span class="up">+' + fmt(gained) + "</span> in range" : ""));
      }).join("") + (Object.keys(rv.perPlatform).length > 1 ? tile("Store ratings total", fmt(rv.total), rv.avg ? stars(rv.avg) + " " + rv.avg.toFixed(2) + " weighted" : "no ratings yet") : "") : "") +
      tile("Site rating", d.feedback.site.avg ? d.feedback.site.avg.toFixed(2) + " ★" : "—",
        fmt(d.feedback.site.n) + " ratings" + (d.feedback.pictures.n ? " · pictures " + pct(d.feedback.pictures.loved / d.feedback.pictures.n) + " 😍" : "")) +
      tile("Retention", pct(d.retention.d1) + " / " + pct(d.retention.d7), "D1 / D7 · cohorts " + fmt(d.retention.d1Base) + " / " + fmt(d.retention.d7Base)) +
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
          : '<p class="muted" style="margin-top:6px">Apple publishes only the count and average; the star split comes from written reviews (needs the App Store Connect key).</p>';
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
        return '<div class="review"><i class="dot" style="background:' + PCOL[r.platform] + '"></i>' + stars(r.rating) + ' <span class="muted">' + esc(String(r.created_at).slice(0, 10)) + " " + esc(r.territory || r.lang || "") + (r.app_version ? " v" + esc(r.app_version) : "") + "</span> " +
          (r.replied === true ? '<span class="badge ok">replied</span>' : r.replied === false ? '<span class="badge">no reply</span>' : "") +
          (r.title ? "<br><b>" + esc(r.title) + "</b>" : "") + (r.body ? "<br>" + esc(r.body) : "") + "</div>";
      }).join("") : '<p class="muted">No written reviews yet (iOS needs the App Store Connect key; Android imports the last 7 days nightly).</p>';
      html.push(section("⭐ App Store &amp; Google Play ratings") + '<div class="grid">' + storeCards +
        card("Rating count over time", lineChart(rv.trend, trendSeries) + legend(Object.keys(rv.perPlatform)), "daily snapshot") +
        card("Average over time", lineChart(rv.trend, avgSeries, function (v) { return Number(v).toFixed(2); }) + legend(Object.keys(rv.perPlatform))) +
        (rv.iosCountries.length ? card("App Store ratings by country", hbars(rv.iosCountries, function (r) { return esc(r.country); }, function (r) { return r.n; })) : "") +
        card("Latest written reviews", '<div class="scroll">' + recentRv + "</div>") +
        "</div>");
    }

    html.push(section("👥 Users &amp; activity"));
    var ak = keysIn(d.series.activeUsers), dk = keysIn(d.series.drawings), sk = keysIn(d.series.downloads);
    var fails = d.series.drawings.reduce(function (a, p) { return a + p._fail; }, 0);
    html.push('<div class="grid">' +
      card("Active users per day", stacked(d.series.activeUsers, ak) + legend(ak), "unique installs + web visitors") +
      card("Drawings per day", stacked(d.series.drawings, dk) + legend(dk), fmt(fails) + " failed in range") +
      (d.platform === "web" ? "" : card("Downloads per day", stacked(d.series.downloads, sk) + legend(sk), "App Store + Google Play")) +
      "</div>");

    // Website traffic — Cloudflare edge (everyone, incl. bots and pre-tracking history)
    if (d.traffic) {
      var tr = d.traffic;
      var trBody = tr.days.length
        ? '<div class="grid">' +
            card("Visitors &amp; page views per day", lineChart(tr.days, [
              { key: "uniques", color: "var(--web)", name: "unique visitors" },
              { key: "pageviews", color: "var(--ios)", name: "page views" }]) +
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
        : '<div class="card"><p class="muted">Not connected yet — add a Cloudflare API token with <b>Zone → Analytics → Read</b> for lalabuba.com as the <code>CF_ANALYTICS_TOKEN</code> secret. History back to 30 days fills in on the next import.</p></div>';
      html.push(section("🌐 Website traffic") + trBody);
    }

    // Prompts
    html.push(section("🎨 What people draw"));
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
    html.push(section("📱 Screens, pages &amp; actions"));
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
    html.push(section("📣 Where users come from"));
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
      return '<div class="review"><i class="dot" style="background:' + (PCOL[c.platform] || "var(--app)") + '"></i>' + stars(c.rating) + ' <span class="muted">' + esc(String(c.ts).slice(0, 10)) + " " + esc(c.country || "") + " " + esc(c.lang || "") + "</span><br>" + esc(c.comment) + "</div>";
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
    html.push(section("💬 In-app feedback &amp; ratings") + '<div class="grid">' +
      card("Site rating", siteBody, "grown-ups, 1–5 ★") +
      card("Feedback comments", '<div class="scroll">' + comments + "</div>") +
      card("Picture ratings", picBody, "kids, after finishing a picture") +
      card("Other signals", signals) +
      "</div>");

    // App quality — Android vitals (Play Developer Reporting API)
    if (d.vitals) {
      var vt = d.vitals, lv = vt.latest, rate = function (v) { return v == null ? "—" : (v * 100).toFixed(2) + "%"; };
      var flag = function (v, lim) { return v == null ? "" : v > lim ? '<span class="bad">above Play\\'s bad-behaviour line (' + rate(lim) + ")</span>" : '<span class="ok">under Play\\'s ' + rate(lim) + " line</span>"; };
      html.push(section("🛠 App quality (Android vitals)") + (vt.days.length
        ? '<div class="tiles">' +
            tile("User-perceived crash rate", rate(lv.crash_rate_user), flag(lv.crash_rate_user, vt.thresholds.crash_rate_user)) +
            tile("User-perceived ANR rate", rate(lv.anr_rate_user), flag(lv.anr_rate_user, vt.thresholds.anr_rate_user)) +
            tile("Crash rate (all)", rate(lv.crash_rate), "ANR " + rate(lv.anr_rate)) +
            tile("Users measured", fmt(lv.vitals_users), "latest day " + esc(lv.day)) +
          '</div><div class="grid">' + card("Crash &amp; ANR rate per day", lineChart(vt.days, [
              { key: "crash_rate_user", color: "var(--bad)", name: "crash rate" },
              { key: "anr_rate_user", color: "#f5a623", name: "ANR rate" }], rate) +
              '<div class="legend"><span><i class="dot" style="background:var(--bad)"></i>Crash (user-perceived)</span><span><i class="dot" style="background:#f5a623"></i>ANR (user-perceived)</span></div>', "last 30 days, Play Console data") + "</div>"
        : '<div class="card"><p class="muted">No vitals yet. Needs the <b>Google Play Developer Reporting API</b> switched on for the service account\\'s Cloud project (link in Store imports below); Play then reports crash &amp; ANR rates once enough users are active.</p></div>'));
    }

    // Health
    html.push(section("🩺 Health &amp; imports"));
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
