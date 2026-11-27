#!/usr/bin/env python3
"""App Store localisations (growth plan L6): name, subtitle, keywords, description
and What's New for 10 languages, through the App Store Connect API. NEVER submits
for review (that stays appstore-submit, on the owner's go).

MODE (env or argv[1]):
  check   offline: build every field, check Apple's limits + keyword rules (default)
  status  read-only: app versions + their states, app info localisations
  apply   once the live version is approved: create the next App Store version
          (NEXT_VERSION, default = live version patch + 1) if there is no editable
          one, then create/update the localisations on it and on the editable app info
  verify  read everything back and compare with what check builds; exit 1 on a diff

Runs on Codemagic (workflow `appstore-localize`; the `Bonistock ASC` integration
gives APP_STORE_CONNECT_ISSUER_ID / _KEY_IDENTIFIER / _PRIVATE_KEY). Data:
flutter_app/store/appstore_listing.json, docs/store-listing/<lang>.md (Play
drafts) and flutter_app/store/whats_new.json.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIMITS = {"name": 30, "subtitle": 30, "keywords": 100, "description": 4000, "whatsNew": 4000}
# Price / ranking terms Apple rejects in name, subtitle and keywords (2.3.7).
BANNED = re.compile(r"\bfree\b|\bbest\b|#\s*1\b|\bgratis\b|kostenlos|gratuit|ücretsiz|darmow|бесплатн|gratuito|\bgratis\b|\bapp\b", re.I)
SUBMIT_STATES = {"WAITING_FOR_REVIEW", "IN_REVIEW", "PENDING_DEVELOPER_RELEASE", "PROCESSING_FOR_APP_STORE",
                 "PENDING_APPLE_RELEASE"}
EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"}


def n(s):
    return len(s)  # Apple counts characters


def play_description(lang):
    text = open(os.path.join(ROOT, "docs", "store-listing", f"{lang}.md"), encoding="utf-8").read()
    # Sections are introduced by bold headings; the 3rd one is the full description.
    parts = re.split(r"^\*\*[^\n]*\*\*\s*$", text, flags=re.M)
    return parts[3].strip()


def words(s):
    return {w for w in re.findall(r"[^\W\d_]+", s.lower()) if len(w) > 1}


def build():
    listing = json.load(open(os.path.join(ROOT, "flutter_app", "store", "appstore_listing.json"), encoding="utf-8"))
    whats_new = json.load(open(os.path.join(ROOT, "flutter_app", "store", "whats_new.json"), encoding="utf-8"))
    out, problems = {}, []
    for locale, f in listing["locales"].items():
        if "description_from" in f:
            desc = play_description(f["description_from"])
            for old, new in f.get("ios", []):
                if desc.count(old) != 1:
                    problems.append(f"{locale}: iOS replacement not found once: {old!r}")
                desc = desc.replace(old, new)
        else:
            desc = f["description"]
        wn = whats_new.get(locale.split("-")[0].lower()) or whats_new["en"]
        rec = {"name": f["name"], "subtitle": f["subtitle"], "keywords": f["keywords"],
               "description": desc, "whatsNew": wn}
        for k, lim in LIMITS.items():
            if n(rec[k]) > lim:
                problems.append(f"{locale}: {k} {n(rec[k])} > {lim}")
            if not rec[k].strip():
                problems.append(f"{locale}: {k} empty")
        for k in ("name", "subtitle", "keywords"):
            if BANNED.search(rec[k]):
                problems.append(f"{locale}: {k} has a banned term: {BANNED.search(rec[k]).group(0)!r}")
        kws = [k for k in rec["keywords"].split(",")]
        if any(k != k.strip() or not k for k in kws):
            problems.append(f"{locale}: keywords need no spaces around commas / no empty entries")
        if len(set(k.lower() for k in kws)) != len(kws):
            problems.append(f"{locale}: duplicate keyword")
        rep = words(rec["keywords"]) & (words(rec["name"]) | words(rec["subtitle"]))
        if rep:
            problems.append(f"{locale}: keywords repeat name/subtitle words {sorted(rep)}")
        if re.search(r"google|android|play store", desc, re.I):
            problems.append(f"{locale}: description mentions Google/Android")
        out[locale] = rec
    return out, problems


def report(data):
    for loc, r in data.items():
        print(f"{loc:6} name {n(r['name']):>2}/30  subtitle {n(r['subtitle']):>2}/30  keywords {n(r['keywords']):>3}/100  "
              f"description {n(r['description']):>4}/4000  whatsNew {n(r['whatsNew']):>3}/4000  | {r['name']} — {r['subtitle']}")


# ── App Store Connect ──────────────────────────────────────────────────────────
def asc():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import asc_submit_review as a  # token(), call(), APP_ID
    return a


def versions(a):
    vs = a.call("GET", f"/apps/{a.APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20")["data"]
    return [(v["id"], v["attributes"]["versionString"], v["attributes"]["appStoreState"]) for v in vs]


def app_infos(a):
    return [(i["id"], i["attributes"].get("state") or i["attributes"].get("appStoreState"))
            for i in a.call("GET", f"/apps/{a.APP_ID}/appInfos")["data"]]


def editable_targets(a):
    vs = versions(a)
    ver = next(((i, s, st) for i, s, st in vs if st in EDITABLE), None)
    info = next(((i, st) for i, st in app_infos(a) if st in EDITABLE or st == "PREPARE_FOR_SUBMISSION"), None)
    return vs, ver, info


def status(a):
    for i, s, st in versions(a):
        print(f"version {s:8} {st:28} {i}")
    for i, st in app_infos(a):
        locs = a.call("GET", f"/appInfos/{i}/appInfoLocalizations?limit=50")["data"]
        print(f"appInfo {i} {st}: " + ", ".join(
            f"{l['attributes']['locale']}={l['attributes'].get('name')!r}/{l['attributes'].get('subtitle')!r}" for l in locs))


def bump(v):
    p = [int(x) for x in v.split(".")]
    p[-1] += 1
    return ".".join(map(str, p))


def apply(a, data):
    vs, ver, info = editable_targets(a)
    if not ver:
        busy = [(s, st) for _, s, st in vs if st in SUBMIT_STATES]
        if busy:
            raise SystemExit(f"not yet: {busy} still with Apple — re-run once it is approved (READY_FOR_SALE)")
        live = next((s for _, s, st in vs if st == "READY_FOR_SALE"), None)
        nxt = os.environ.get("NEXT_VERSION") or bump(live)
        r = a.call("POST", "/appStoreVersions", {"data": {
            "type": "appStoreVersions",
            "attributes": {"platform": "IOS", "versionString": nxt, "releaseType": "AFTER_APPROVAL"},
            "relationships": {"app": {"data": {"type": "apps", "id": a.APP_ID}}}}})["data"]
        ver = (r["id"], nxt, r["attributes"]["appStoreState"])
        print(f"created App Store version {nxt} ({ver[0]}), no build attached, NOT submitted")
        vs, _, info = editable_targets(a)
    print(f"editing version {ver[1]} ({ver[2]}) and app info {info}")
    if not info:
        raise SystemExit("no editable app info (name/subtitle) — Apple opens it with a new version")

    # Version localisations: description, keywords, What's New (+ URLs copied from en-US).
    vlocs = {l["attributes"]["locale"]: l for l in
             a.call("GET", f"/appStoreVersions/{ver[0]}/appStoreVersionLocalizations?limit=50")["data"]}
    base = vlocs.get("en-US", {}).get("attributes", {})
    for loc, r in data.items():
        attrs = {"description": r["description"], "keywords": r["keywords"], "whatsNew": r["whatsNew"]}
        if loc in vlocs:
            a.call("PATCH", f"/appStoreVersionLocalizations/{vlocs[loc]['id']}",
                   {"data": {"type": "appStoreVersionLocalizations", "id": vlocs[loc]["id"], "attributes": attrs}})
            print(f"{loc}: version localisation updated")
        else:
            for k in ("supportUrl", "marketingUrl"):
                if base.get(k):
                    attrs[k] = base[k]
            a.call("POST", "/appStoreVersionLocalizations", {"data": {
                "type": "appStoreVersionLocalizations", "attributes": {"locale": loc, **attrs},
                "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": ver[0]}}}}})
            print(f"{loc}: version localisation created")

    # App info localisations: name + subtitle (+ privacy policy URL copied from en-US).
    ilocs = {l["attributes"]["locale"]: l for l in
             a.call("GET", f"/appInfos/{info[0]}/appInfoLocalizations?limit=50")["data"]}
    pp = ilocs.get("en-US", {}).get("attributes", {}).get("privacyPolicyUrl")
    for loc, r in data.items():
        attrs = {"name": r["name"], "subtitle": r["subtitle"]}
        if loc in ilocs:
            a.call("PATCH", f"/appInfoLocalizations/{ilocs[loc]['id']}",
                   {"data": {"type": "appInfoLocalizations", "id": ilocs[loc]["id"], "attributes": attrs}})
            print(f"{loc}: name/subtitle updated")
        else:
            if pp:
                attrs["privacyPolicyUrl"] = pp
            a.call("POST", "/appInfoLocalizations", {"data": {
                "type": "appInfoLocalizations", "attributes": {"locale": loc, **attrs},
                "relationships": {"appInfo": {"data": {"type": "appInfos", "id": info[0]}}}}})
            print(f"{loc}: name/subtitle created")


def verify(a, data):
    vs, ver, info = editable_targets(a)
    if not ver or not info:
        raise SystemExit(f"nothing editable to verify: versions={vs} info={info}")
    vlocs = {l["attributes"]["locale"]: l["attributes"] for l in
             a.call("GET", f"/appStoreVersions/{ver[0]}/appStoreVersionLocalizations?limit=50")["data"]}
    ilocs = {l["attributes"]["locale"]: l["attributes"] for l in
             a.call("GET", f"/appInfos/{info[0]}/appInfoLocalizations?limit=50")["data"]}
    bad = 0
    norm = lambda s: (s or "").replace("\r\n", "\n").strip()
    for loc, r in data.items():
        got = {**{k: vlocs.get(loc, {}).get(k) for k in ("description", "keywords", "whatsNew")},
               **{k: ilocs.get(loc, {}).get(k) for k in ("name", "subtitle")}}
        diffs = [k for k in r if norm(got[k]) != norm(r[k])]
        bad += bool(diffs)
        print(f"{loc:6} {'OK' if not diffs else 'DIFF ' + ','.join(diffs)}")
    print(f"version {ver[1]} {ver[2]} — {len(data) - bad}/{len(data)} languages match; not submitted for review")
    if bad:
        raise SystemExit(1)


if __name__ == "__main__":
    mode = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MODE", "check")).lower()
    data, problems = build()
    report(data)
    if problems:
        print("\n".join("PROBLEM " + p for p in problems))
        raise SystemExit(1)
    print("limits + keyword rules: OK")
    if mode == "check":
        raise SystemExit(0)
    a = asc()
    {"status": lambda: status(a), "apply": lambda: (apply(a, data), verify(a, data)),
     "verify": lambda: verify(a, data)}[mode]()
