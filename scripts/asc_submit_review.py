#!/usr/bin/env python3
"""Submit the current pubspec version to App Store review (idempotent).

Runs on Codemagic (workflow `appstore-submit`) where the `Bonistock ASC`
integration exposes APP_STORE_CONNECT_ISSUER_ID / _KEY_IDENTIFIER / _PRIVATE_KEY.

Steps: wait for the newest processed build of the version → create or reuse the
App Store version, attach the build → set `whatsNew` on every localization from
flutter_app/store/whats_new.json → add the version to a review submission and
submit it. Safe to re-run: stops early if the version is already in review.
"""
import json, os, re, time, urllib.error, urllib.request
from datetime import datetime

import jwt  # PyJWT (ships with codemagic-cli-tools)

APP_ID = os.environ.get("APP_STORE_APPLE_ID", "6761691648")
API = "https://api.appstoreconnect.apple.com/v1"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE_TYPE = os.environ.get("RELEASE_TYPE", "AFTER_APPROVAL")
WAIT_MINUTES = int(os.environ.get("BUILD_WAIT_MINUTES", "90"))
# ISO-8601 UTC; when set, only builds uploaded at/after it qualify (the release
# pipeline passes its dispatch time so a stale earlier build is never submitted).
NOT_BEFORE = os.environ.get("NOT_BEFORE", "")


def uploaded_before_cutoff(build):
    if not NOT_BEFORE:
        return False
    parse = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
    return parse(build["attributes"]["uploadedDate"]) < parse(NOT_BEFORE)
IN_REVIEW = {"WAITING_FOR_REVIEW", "IN_REVIEW", "PENDING_DEVELOPER_RELEASE",
             "PROCESSING_FOR_APP_STORE", "READY_FOR_SALE", "PENDING_APPLE_RELEASE"}


def private_key():
    # Same value forms codemagic-cli-tools accepts: PEM (possibly with literal
    # "\n" escapes), "@env:VAR", "@file:PATH", or a bare base64 key body.
    key = os.environ["APP_STORE_CONNECT_PRIVATE_KEY"].strip()
    while key.startswith("@env:") or key.startswith("@file:"):
        ref = key.split(":", 1)[1]
        key = (os.environ[ref] if key.startswith("@env:")
               else open(os.path.expanduser(ref), encoding="utf-8").read()).strip()
    # Rebuild clean PEM framing: the body may arrive with newlines turned into
    # spaces or "\n" escapes, which cryptography rejects as MalformedFraming.
    key = key.replace("\\n", "\n").strip().strip('"')
    body = re.sub(r"-----(BEGIN|END)[A-Z ]*-----", "", key)
    body = "".join(body.split())
    return ("-----BEGIN PRIVATE KEY-----\n"
            + "\n".join(body[i:i + 64] for i in range(0, len(body), 64))
            + "\n-----END PRIVATE KEY-----\n")


def token():
    key = private_key()
    now = int(time.time())
    return jwt.encode(
        {"iss": os.environ["APP_STORE_CONNECT_ISSUER_ID"], "iat": now,
         "exp": now + 1000, "aud": "appstoreconnect-v1"},
        key, algorithm="ES256",
        headers={"kid": os.environ["APP_STORE_CONNECT_KEY_IDENTIFIER"], "typ": "JWT"})


def call(method, path, body=None):
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(url, method=method,
                                 data=json.dumps(body).encode() if body else None)
    req.add_header("Authorization", "Bearer " + token())
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise SystemExit(f"{method} {path} → HTTP {e.code}\n{detail}")


def pubspec_version():
    text = open(os.path.join(ROOT, "flutter_app", "pubspec.yaml"), encoding="utf-8").read()
    return re.search(r"^version:\s*([0-9.]+)\+", text, re.M).group(1)


def latest_valid_build(version):
    deadline = time.time() + WAIT_MINUTES * 60
    while True:
        builds = call("GET", f"/builds?filter[app]={APP_ID}"
                             f"&filter[preReleaseVersion.version]={version}"
                             "&sort=-uploadedDate&limit=1")["data"]
        if builds and uploaded_before_cutoff(builds[0]):
            print(f"newest build {builds[0]['attributes']['version']} predates {NOT_BEFORE}; waiting for the new upload")
        elif builds:
            b = builds[0]
            state = b["attributes"]["processingState"]
            print(f"newest build {b['attributes']['version']} ({b['id']}): {state}")
            if state == "VALID":
                return b
            if state in ("FAILED", "INVALID"):
                raise SystemExit("newest build failed App Store processing")
        else:
            print(f"no build for {version} yet")
        if time.time() > deadline:
            raise SystemExit(f"timed out after {WAIT_MINUTES} min waiting for a processed build")
        time.sleep(30)


def main():
    missing = [k for k in ("APP_STORE_CONNECT_ISSUER_ID", "APP_STORE_CONNECT_KEY_IDENTIFIER",
                           "APP_STORE_CONNECT_PRIVATE_KEY") if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"missing ASC credentials in env: {missing}")

    version = pubspec_version()
    notes = json.load(open(os.path.join(ROOT, "flutter_app", "store", "whats_new.json"),
                           encoding="utf-8"))
    print(f"submitting iOS {version} to App Store review ({RELEASE_TYPE})")

    versions = call("GET", f"/apps/{APP_ID}/appStoreVersions?filter[platform]=IOS"
                           f"&filter[versionString]={version}")["data"]
    if versions and versions[0]["attributes"]["appStoreState"] in IN_REVIEW:
        print(f"version already {versions[0]['attributes']['appStoreState']} — nothing to do")
        return

    build = latest_valid_build(version)

    if versions:
        vid = versions[0]["id"]
        call("PATCH", f"/appStoreVersions/{vid}",
             {"data": {"type": "appStoreVersions", "id": vid,
                       "attributes": {"releaseType": RELEASE_TYPE}}})
        call("PATCH", f"/appStoreVersions/{vid}/relationships/build",
             {"data": {"type": "builds", "id": build["id"]}})
        print(f"reusing App Store version {vid}, attached build {build['attributes']['version']}")
    else:
        vid = call("POST", "/appStoreVersions", {"data": {
            "type": "appStoreVersions",
            "attributes": {"platform": "IOS", "versionString": version,
                           "releaseType": RELEASE_TYPE},
            "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}},
                              "build": {"data": {"type": "builds", "id": build["id"]}}}}})["data"]["id"]
        print(f"created App Store version {vid}")

    locs = call("GET", f"/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=50")["data"]
    for loc in locs:
        locale = loc["attributes"]["locale"]
        text = notes.get(locale.split("-")[0].lower(), notes["en"])
        call("PATCH", f"/appStoreVersionLocalizations/{loc['id']}",
             {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"],
                       "attributes": {"whatsNew": text}}})
        print(f"whatsNew set: {locale}")

    open_subs = call("GET", f"/reviewSubmissions?filter[app]={APP_ID}&filter[platform]=IOS"
                            "&filter[state]=READY_FOR_REVIEW")["data"]
    if open_subs:
        sid = open_subs[0]["id"]
        print(f"reusing review submission {sid}")
    else:
        sid = call("POST", "/reviewSubmissions", {"data": {
            "type": "reviewSubmissions", "attributes": {"platform": "IOS"},
            "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}}}}})["data"]["id"]
        print(f"created review submission {sid}")

    items = call("GET", f"/reviewSubmissions/{sid}/items?include=appStoreVersion")["data"]
    has_item = any((i["relationships"].get("appStoreVersion", {}).get("data") or {}).get("id") == vid
                   for i in items)
    if not has_item:
        call("POST", "/reviewSubmissionItems", {"data": {
            "type": "reviewSubmissionItems",
            "relationships": {
                "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sid}},
                "appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
        print("added version to review submission")

    res = call("PATCH", f"/reviewSubmissions/{sid}",
               {"data": {"type": "reviewSubmissions", "id": sid,
                         "attributes": {"submitted": True}}})
    print(f"review submission state: {res['data']['attributes']['state']}")


if __name__ == "__main__":
    main()
