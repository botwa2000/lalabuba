#!/usr/bin/env python3
"""List all App Store customer reviews (every territory) via the ASC API.

Runs on Codemagic (workflow `appstore-reviews`) with the Bonistock ASC
integration credentials. Star-only ratings without text are NOT exposed by the
ASC API; the public per-country counts come from itunes.apple.com/lookup.
"""
import json, os, sys, urllib.request
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asc_submit_review import APP_ID, call  # noqa: E402


def main():
    reviews, url = [], f"/apps/{APP_ID}/customerReviews?limit=200&sort=-createdDate"
    while url:
        page = call("GET", url)
        reviews += page["data"]
        url = page.get("links", {}).get("next")
    print(f"written reviews (all territories): {len(reviews)}")
    by_country = Counter(r["attributes"]["territory"] for r in reviews)
    print("by territory:", dict(by_country))
    for r in reviews:
        a = r["attributes"]
        print(f"- {a['createdDate'][:10]} {a['territory']} {a['rating']}★ "
              f"{a.get('title') or ''!r}: {(a.get('body') or '')[:200]!r}")

    print("\npublic rating counts per storefront (non-zero):")
    for c in os.environ.get("COUNTRIES", "us gb de tr at ch fr es it nl pl ru").split():
        with urllib.request.urlopen(f"https://itunes.apple.com/lookup?id={APP_ID}&country={c}") as f:
            d = json.load(f)
        n = d["results"][0].get("userRatingCount", 0) if d["resultCount"] else 0
        if n:
            print(f"  {c}: {n} (avg {d['results'][0].get('averageUserRating')})")


if __name__ == "__main__":
    main()
