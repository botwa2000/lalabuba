#!/usr/bin/env python3
"""Make sure the App Store provisioning profile carries App Attest.

Firebase App Check on iOS uses App Attest, which needs the
com.apple.developer.devicecheck.appattest-environment entitlement
(ios/Runner/Runner.entitlements). A profile only carries it if the App ID
com.lalabuba.lalabuba has the "App Attest" capability when the profile is made.

Apple's API can neither show nor set that capability (bundleIdCapabilities
rejects capabilityType APP_ATTEST with 409), so it is enabled once by hand:
developer.apple.com → Identifiers → com.lalabuba.lalabuba → App Attest → Save.
What the API CAN do is read each profile's content, so this script checks the
entitlement there:

  (default)  before fetch-signing-files: delete App Store profiles that lack
             the entitlement, so `fetch-signing-files --create` mints a fresh
             one from the App ID's current capabilities.
  --verify   after fetch-signing-files: fail with a clear message if the
             profile still lacks it (the capability was never enabled), instead
             of a cryptic export error 10 minutes later.

Auth: same App Store Connect API key env vars as asc_submit_review.py.
"""
import base64
import sys

from asc_submit_review import call

BUNDLE = "com.lalabuba.lalabuba"
ENTITLEMENT = b"com.apple.developer.devicecheck.appattest-environment"
HOW_TO_FIX = ("Enable it once at developer.apple.com → Certificates, Identifiers & "
              f"Profiles → Identifiers → {BUNDLE} → tick 'App Attest' → Save, then rebuild.")


def app_store_profiles():
    found = call("GET", f"/bundleIds?filter[identifier]={BUNDLE}&limit=5")["data"]
    matches = [b for b in found if b["attributes"]["identifier"] == BUNDLE]
    if not matches:
        sys.exit(f"bundle id {BUNDLE} not found in App Store Connect")
    profiles = call("GET", f"/bundleIds/{matches[0]['id']}/profiles?limit=200")["data"]
    return [p for p in profiles if p["attributes"]["profileType"] == "IOS_APP_STORE"]


def active(p):
    return p["attributes"]["profileState"] == "ACTIVE"


def has_app_attest(profile):
    # profileContent is the signed .mobileprovision; its plist sits in it as text.
    return ENTITLEMENT in base64.b64decode(profile["attributes"]["profileContent"])


def main():
    verify = "--verify" in sys.argv
    profiles = app_store_profiles()
    good = [p for p in profiles if active(p) and has_app_attest(p)]
    if verify:
        if not good:
            sys.exit(f"No App Store profile for {BUNDLE} carries App Attest: the App ID "
                     f"lacks the capability. {HOW_TO_FIX}")
        print(f"profile {good[0]['attributes']['name']} carries App Attest")
        return
    for p in profiles:
        if not (active(p) and has_app_attest(p)):
            call("DELETE", f"/profiles/{p['id']}")
            print(f"deleted {p['attributes']['profileState']} profile without App Attest: "
                  f"{p['attributes']['name']} ({p['id']})")
    print(f"{len(good)} profile(s) already carry App Attest")


if __name__ == "__main__":
    main()
