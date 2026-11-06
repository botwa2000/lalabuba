"use strict";
// Pure view helpers of the /admin/stats page: labels, the two chart types and the
// hints that depend on the store feeds. lib/render-admin-stats.js inlines
// viewHelpers() into the page (nothing third-party, no build step) and the unit
// tests call the same code in node, so the function must stay self-contained:
// no closures over this module, no require, plain ES5.

function viewHelpers() {
  var PCOL = { web: "var(--web)", ios: "var(--ios)", android: "var(--android)", app: "var(--app)" };
  var PNAME = { web: "Web", ios: "iOS", android: "Android", app: "App (old build)" };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DOTS_UP_TO = 31;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // A tooltip's text inside data-tip. The page writes it with textContent.
  function attr(v) { return esc(v).replace(/\n/g, "&#10;"); }
  function fmt(n) { return n == null ? "—" : Number(n).toLocaleString("en-US"); }

  function periodLabel(day, bucket) {
    if (bucket === "month") return MON[+day.slice(5, 7) - 1] + " " + day.slice(0, 4);
    if (bucket === "week") return "Week of " + day;
    return DOW[new Date(day + "T00:00:00Z").getUTCDay()] + " " + day;
  }
  function tick(day, bucket) { return bucket === "month" ? MON[+day.slice(5, 7) - 1] : day.slice(5); }

  // Change against the previous period; nothing at all when that period predates
  // tracking, because its numbers are unknown, not zero.
  function delta(cur, prev, tracked) {
    if (tracked === false) return "";
    if (!prev) return cur ? '<span class="muted">new</span>' : "";
    var d = (cur - prev) / prev;
    return '<span class="' + (d >= 0 ? "up" : "down") + '">' + (d >= 0 ? "▲" : "▼") + " " + Math.abs(d * 100).toFixed(0) + "%</span> vs prev";
  }

  // Identity is never colour alone: the dot names its platform too.
  function dot(p) {
    var n = esc(PNAME[p] || p || "App");
    return '<i class="dot" title="' + n + '" role="img" aria-label="' + n + '" style="background:' + (PCOL[p] || "var(--app)") + '"></i>';
  }

  // Up to three whole-number gridlines that contain min and max.
  function wholeTicks(min, max) {
    var lo = Math.floor(min), hi = Math.ceil(max);
    if (hi === lo) { hi = lo + 1; if (lo > 0) lo -= 1; }
    if (hi - lo === 1) return [lo, hi];
    var step = Math.ceil((hi - lo) / 2);
    return [lo, lo + step, lo + 2 * step];
  }
  // Gridlines for fractional values (averages, rates), with a flat line kept mid-chart.
  function fractionTicks(min, max) {
    if (max === min) { var pad = (max || 1) * 0.1; max += pad; min = Math.max(0, min - pad); }
    return [min, (min + max) / 2, max];
  }

  // rows: [{day, <key>: n}], series: [{key, color, name}].
  // opt.fmtY formats fractional values; opt.total adds a total to the tooltip.
  function lineChart(rows, series, opt) {
    opt = opt || {};
    var W = 560, H = 150, padL = 34, padR = 22, padB = 18, fmtY = opt.fmtY;
    var vals = [];
    rows.forEach(function (r) { series.forEach(function (s) { if (r[s.key] != null) vals.push(r[s.key]); }); });
    if (!vals.length) return '<p class="muted">No snapshots in this range yet — the store import runs nightly.</p>';
    var low = Math.min.apply(null, vals), high = Math.max.apply(null, vals);
    var ticks = fmtY ? fractionTicks(low, high) : wholeTicks(low, high);
    var min = ticks[0], max = ticks[ticks.length - 1];
    var n = rows.length, plot = W - padL - padR;
    var x = function (i) { return padL + (n === 1 ? plot / 2 : i * plot / (n - 1)); };
    var y = function (v) { return (H - padB) - (v - min) / (max - min) * (H - padB - 8); };
    var label = function (v) { return fmtY ? fmtY(v) : fmt(v); };
    var out = [];
    ticks.forEach(function (v) {
      out.push('<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--grid)"/>');
      out.push('<text x="' + (padL - 4) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + label(v) + "</text>");
    });
    series.forEach(function (s) {
      var pts = [];
      rows.forEach(function (r, i) { if (r[s.key] != null) pts.push([x(i), y(r[s.key])]); });
      if (pts.length > 1) out.push('<polyline fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" points="' + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>');
      if (n <= DOTS_UP_TO) pts.forEach(function (p) { out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="' + s.color + '"/>'); });
    });
    var every = Math.ceil(n / 8), cw = plot / Math.max(1, n - 1);
    rows.forEach(function (r, i) { if (i % every === 0 || n <= 8) out.push('<text x="' + x(i).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + r.day.slice(5) + "</text>"); });
    rows.forEach(function (r, i) {
      var shown = series.filter(function (s) { return r[s.key] != null; });
      var lines = [r.day].concat(shown.map(function (s) { return s.name + ": " + label(r[s.key]); }));
      if (opt.total && shown.length > 1) lines.push("Total: " + fmt(shown.reduce(function (a, s) { return a + r[s.key]; }, 0)));
      var left = n === 1 ? padL : Math.max(padL, x(i) - cw / 2), right = n === 1 ? W - padR : Math.min(W, x(i) + cw / 2);
      out.push('<rect class="hit" x="' + left.toFixed(1) + '" y="0" width="' + (right - left).toFixed(1) + '" height="' + (H - padB) + '" data-tip="' + attr(lines.join("\n")) + '"/>');
    });
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img">' + out.join("") + "</svg>";
  }

  // Stacked bars per platform. points: [{day, web: n, ios: n, ..., _total?, tracked?}]
  // _total is the distinct total when the server knows it, else the bars' sum.
  function stacked(points, keys, bucket) {
    var W = 560, H = 150, padL = 30, padR = 14, padT = 8, padB = 18, plotH = H - padT - padB, n = points.length || 1;
    var max = 1;
    points.forEach(function (p) { var t = 0; keys.forEach(function (k) { t += p[k] || 0; }); if (t > max) max = t; });
    if (max > 1) max = Math.ceil(max / 2) * 2; // keeps the middle gridline a whole number
    var bw = (W - padL - padR) / n, out = [], every = Math.ceil(n / 8);
    (max === 1 ? [0, 1] : [0, 0.5, 1]).forEach(function (f) {
      var y = padT + plotH * (1 - f);
      out.push('<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="var(--grid)"/>');
      out.push('<text x="' + (padL - 4) + '" y="' + (y + 3) + '" text-anchor="end">' + fmt(max * f) + "</text>");
    });
    points.forEach(function (p, i) {
      var y = H - padB, x = padL + i * bw + bw * 0.15, w = Math.max(1, bw * 0.7), sum = 0;
      keys.forEach(function (k) {
        var v = p[k] || 0; if (!v) return;
        sum += v;
        var h = plotH * v / max; y -= h;
        out.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + PCOL[k] + '" rx="1.5" stroke="var(--surface)" stroke-width="1"/>');
      });
      if (i % every === 0 || n <= 8) out.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + tick(p.day, bucket) + "</text>");
      var lines = [periodLabel(p.day, bucket)];
      if (p.tracked === false) lines.push("Not tracked yet");
      else {
        keys.forEach(function (k) { lines.push(PNAME[k] + ": " + fmt(p[k] || 0)); });
        if (keys.length > 1) lines.push("Total: " + fmt(p._total != null ? p._total : sum));
      }
      out.push('<rect class="hit" x="' + (padL + i * bw).toFixed(1) + '" y="0" width="' + bw.toFixed(1) + '" height="' + (H - padB) + '" data-tip="' + attr(lines.join("\n")) + '"/>');
    });
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img">' + out.join("") + "</svg>";
  }

  // ── Store feeds ────────────────────────────────────────────────────────────
  // id → "ok" | "failing" | "missing", from health.imports. Hints name a missing
  // credential only when the feed really lacks it.
  function feedStates(imports) {
    var m = {};
    (imports || []).forEach(function (r) { m[r.source] = r.ok ? "ok" : /^not configured/.test(r.detail || "") ? "missing" : "failing"; });
    return m;
  }
  function feedHint(state, needs) { return state === "ok" ? "" : state === "failing" ? "the last import failed, see Store imports" : needs; }

  function iosHistogramNote(feeds) {
    var why = feedHint(feeds.asc_reviews, "needs the App Store Connect key");
    return "Apple publishes only the count and average; the star split comes from written reviews" + (why ? " (" + why + ")" : "") + ".";
  }
  function noReviewsNote(feeds, platforms) {
    var why = [];
    if (platforms.indexOf("ios") >= 0) why.push(feedHint(feeds.asc_reviews, "iOS needs the App Store Connect key"));
    if (platforms.indexOf("android") >= 0) why.push(feedHint(feeds.play_reviews, "Android needs the Play service account"));
    why = why.filter(Boolean);
    return why.length ? "No written reviews yet (" + why.join("; ") + ")." : "No written reviews yet. Connected ✓, imported nightly.";
  }
  function noStoreSourcesNote(feeds) {
    var why = [feedHint(feeds.asc_analytics, "iOS needs the App Store Connect key with the Admin role"),
      feedHint(feeds.play_reports, "Android needs the Play reports bucket")].filter(Boolean);
    return why.length ? "No store sources yet (" + why.join("; ") + ")." : "No store sources in this range. Connected ✓, imported nightly.";
  }
  function noEdgeNote(feeds) {
    if (feeds.cf_traffic === "ok") return "Cloudflare connected ✓ — no traffic imported for this period.";
    return feeds.cf_traffic === "failing" ? "The last Cloudflare import failed, see Store imports."
      : "Not connected yet — add a Cloudflare API token with <b>Zone → Analytics → Read</b> for lalabuba.com as the <code>CF_ANALYTICS_TOKEN</code> secret. History back to 30 days fills in on the next import.";
  }
  function noVitalsNote(feeds) {
    if (feeds.play_vitals === "ok") return "Reporting API connected ✓ — Play publishes crash &amp; ANR rates only once enough users are active; they appear here automatically.";
    return feeds.play_vitals === "failing" ? "The last vitals import failed, see Store imports."
      : "No vitals yet. Needs the <b>Google Play Developer Reporting API</b> switched on for the service account's Cloud project.";
  }

  return {
    PCOL: PCOL, PNAME: PNAME, esc: esc, fmt: fmt, periodLabel: periodLabel, delta: delta, dot: dot,
    wholeTicks: wholeTicks, lineChart: lineChart, stacked: stacked,
    feedStates: feedStates, iosHistogramNote: iosHistogramNote, noReviewsNote: noReviewsNote,
    noStoreSourcesNote: noStoreSourcesNote, noEdgeNote: noEdgeNote, noVitalsNote: noVitalsNote,
  };
}

module.exports = { viewHelpers };
