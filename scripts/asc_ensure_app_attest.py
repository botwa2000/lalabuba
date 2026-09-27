#!/usr/bin/env python3
"""Ensure the App Attest capability is enabled on com.lalabuba.lalabuba.

Firebase App Check on iOS uses App Attest, which needs the
com.apple.developer.devicecheck.appattest-environment entitlement
(ios/Runner/Runner.entitlements). A provisioning profile only carries that
entitlement if the App ID has the APP_ATTEST capability when the profile is
created. This script is idempotent and runs before `fetch-signing-files`:

  capability present  → nothing to do
  capability missing  → enable it, then delete this bundle's existing App Store
                        profiles (they predate the capability and lack the
                        entitlement) so fetch-signing-files --create mints a
                        fresh, correct one.

Auth: same App Store Connect API key env vars as asc_submit_review.py.
"""
import sys

from asc_submit_review import call

BUNDLE = "com.lalabuba.lalabuba"
CAPABILITY = "APP_ATTEST"


def main():
    found = call("GET", f"/bundleIds?filter[identifier]={BUNDLE}&limit=5")["data"]
    matches = [b for b in found if b["attributes"]["identifier"] == BUNDLE]
    if not matches:
        sys.exit(f"bundle id {BUNDLE} not found in App Store Connect")
    bid = matches[0]["id"]

    caps = call("GET", f"/bundleIds/{bid}/bundleIdCapabilities?limit=200")["data"]
    if any(c["attributes"]["capabilityType"] == CAPABILITY for c in caps):
        print(f"{CAPABILITY} already enabled on {BUNDLE} — nothing to do")
        return

    call("POST", "/bundleIdCapabilities", {"data": {
        "type": "bundleIdCapabilities",
        "attributes": {"capabilityType": CAPABILITY},
        "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}}},
    }})
    print(f"enabled {CAPABILITY} on {BUNDLE}")

    profiles = call("GET", f"/bundleIds/{bid}/profiles?limit=200")["data"]
    stale = [p for p in profiles if p["attributes"]["profileType"] == "IOS_APP_STORE"]
    for p in stale:
        call("DELETE", f"/profiles/{p['id']}")
        print(f"deleted stale App Store profile {p['attributes']['name']} ({p['id']})")
    print(f"{len(stale)} stale profile(s) removed — fetch-signing-files --create will issue a fresh one")


if __name__ == "__main__":
    main()
