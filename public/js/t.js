/* First-party usage beacon → POST /api/t (stored in our own database, never
   sent to a third party). Loaded on every page (server.js injects it into
   served HTML; index.html includes it directly).

   Without analytics consent nothing is stored on the device and no identifier
   is sent — the server counts the visit with a daily-rotating anonymous hash.
   With consent (cookie banner, key lala_cookie_consent) the random community
   ID is sent so returning visits can be counted. Exposes window.lalaTrack(event, props).
*/
(function () {
  "use strict";
  if (window.lalaTrack) return;

  var queue = [];
  var timer = null;
  var acq = null;

  function consented() {
    try {
      var p = JSON.parse(localStorage.getItem("lala_cookie_consent") || "null");
      return !!(p && p.analytics);
    } catch (e) { return false; }
  }

  // Same ID and key as community.js getCommunityId(); only read/created with consent.
  function installId() {
    if (!consented()) return null;
    try {
      var id = localStorage.getItem("lalabuba-community-id");
      if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
        id = crypto.randomUUID();
        localStorage.setItem("lalabuba-community-id", id);
      }
      return id;
    } catch (e) { return null; }
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!queue.length) return;
    var payload = {
      iid: installId(),
      wd: navigator.webdriver === true || undefined,
      lang: (document.documentElement.lang || "").slice(0, 2),
      events: queue.splice(0, 50)
    };
    if (acq) { payload.acq = acq; acq = null; }
    var body = JSON.stringify(payload);
    // text/plain keeps sendBeacon a "simple" request (no preflight).
    try {
      if (navigator.sendBeacon && navigator.sendBeacon("/api/t", new Blob([body], { type: "text/plain" }))) return;
    } catch (e) { /* fall through */ }
    try {
      fetch("/api/t", { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(function () {});
    } catch (e) { /* never break the page */ }
  }

  function track(event, props) {
    if (landing && FUNNEL[event]) {
      props = props ? Object.assign({}, props) : {};
      props.lp = landing;
    }
    queue.push({ e: event, s: location.pathname, p: props || undefined, t: Date.now() });
    if (queue.length >= 20) flush();
    else if (!timer) timer = setTimeout(flush, 2000);
  }

  // A visit starts when the previous page was not ours (no storage needed).
  var ref = document.referrer || "";
  var internal = false;
  try {
    var refUrl = ref ? new URL(ref) : null;
    internal = !!refUrl && (refUrl.host === location.host || refUrl.hostname.replace(/^www\./, "").slice(-12) === "lalabuba.com");
  } catch (e) {}
  var params = new URLSearchParams(location.search);
  // ?s=1 opens a picture link. Only a real challenge (share modal) carries
  // seed=. Everything else with s=1 comes from one of our coloring pages:
  // "Color this" on a library picture (img=, opens that exact picture) or
  // "generate one" (q= only). Until 2026-11 any img= link counted as a
  // challenge, so ~80% of coloring-page clicks showed as challenge opens.
  var isShareLink = params.get("s") === "1";
  var isChallenge = isShareLink && params.has("seed");
  var isPageCta = isShareLink && !isChallenge;
  // Which of our pages the click came from (path only), so the dashboard can
  // show page → picture → first fill → finished per landing page. It rides
  // along on the later events of this page load (the app is one page).
  var landing = null;
  if (isPageCta) {
    try { landing = internal ? new URL(ref).pathname.slice(0, 120) : "(direct)"; } catch (e) { landing = "(direct)"; }
  }
  var FUNNEL = { page_cta_open: 1, picture_open: 1, first_fill: 1, complete: 1 };

  if (!internal) {
    acq = {
      utm_source: params.get("utm_source") || (isChallenge ? "challenge" : isPageCta ? "coloring-page" : undefined),
      utm_medium: params.get("utm_medium") || (isChallenge ? "share" : isPageCta ? "cta" : undefined),
      utm_campaign: params.get("utm_campaign") || undefined,
      referrer: ref || undefined
    };
    if (!acq.utm_source && !acq.referrer) acq = null;
    track("app_open");
  }
  track("page_view");
  if (isChallenge) track("challenge_open");
  if (isPageCta) track("page_cta_open");

  // First real interaction on this page → "engage", sent at once: only visitors
  // who interact (or draw) count as people on the dashboard, so link scanners
  // and one-glance bounces don't inflate the numbers.
  // Only deliberate input counts. "scroll" is not used: rendering crawlers
  // scroll the page by script (a nightly one from SG/US datacenters was counted
  // as ~200 people a day in Nov 2026). People who scroll still count, via
  // touchstart (finger) or wheel (mouse/trackpad). Synthetic events are ignored.
  var ENGAGE = ["pointerdown", "keydown", "touchstart", "wheel"];
  var engaged = false;
  function onEngage(e) {
    if (engaged || (e && e.isTrusted === false)) return;
    engaged = true;
    ENGAGE.forEach(function (t) { window.removeEventListener(t, onEngage, true); });
    track("engage");
    flush();
  }
  ENGAGE.forEach(function (t) {
    window.addEventListener(t, onEngage, { capture: true, passive: true });
  });

  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);

  window.lalaTrack = track;
})();
