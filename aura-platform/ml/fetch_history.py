"""Fetch CS2 match history from PandaScore and cache it locally.
Run once; model.py reads the cache. Resumable: won't refetch unless --refresh.

Usage: python -I fetch_history.py --pages 200
"""
import json, os, re, sys, time, argparse
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
CACHE = HERE / "data" / "matches.json"
ENV = HERE.parent / "backend" / ".env"
BASE = "https://api.pandascore.co"


def load_token() -> str:
    txt = ENV.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"^PANDASCORE_TOKEN=(.+)$", txt, re.MULTILINE)
    if not m:
        sys.exit("PANDASCORE_TOKEN not found in backend/.env")
    return m.group(1).strip()


def keep(m: dict) -> dict:
    """Trim to the fields the model needs (keeps the cache small)."""
    return {
        "id": m.get("id"),
        "scheduled_at": m.get("scheduled_at"),
        "begin_at": m.get("begin_at"),
        "winner_id": m.get("winner_id"),
        "draw": m.get("draw"),
        "forfeit": m.get("forfeit"),
        "number_of_games": m.get("number_of_games"),
        "match_type": m.get("match_type"),
        "league_name": (m.get("league") or {}).get("name"),
        "serie_tier": (m.get("serie") or {}).get("tier"),
        "opponents": [
            {"type": o.get("type"),
             "id": (o.get("opponent") or {}).get("id"),
             "name": (o.get("opponent") or {}).get("name")}
            for o in (m.get("opponents") or [])
        ],
        "games": [
            {"position": g.get("position"),
             "winner_id": (g.get("winner") or {}).get("id"),
             "finished": g.get("finished")}
            for g in (m.get("games") or [])
        ],
    }


def fetch_page(token: str, page: int, tries: int = 0) -> list:
    url = f"{BASE}/csgo/matches/past?per_page=100&page={page}&sort=-scheduled_at&token={token}"
    r = requests.get(url, timeout=30)
    if r.status_code == 429 and tries < 6:
        wait = int(r.headers.get("retry-after", "2")) + 1
        print(f"    429 on page {page}; waiting {wait}s")
        time.sleep(wait)
        return fetch_page(token, page, tries + 1)
    r.raise_for_status()
    return r.json()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=200)
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    if CACHE.exists() and not args.refresh:
        data = json.loads(CACHE.read_text())
        print(f"Cache exists: {len(data)} matches at {CACHE}. Use --refresh to refetch.")
        return

    token = load_token()
    out = []
    print(f"Fetching up to {args.pages} pages (~{args.pages*100} matches)...")
    for p in range(1, args.pages + 1):
        batch = fetch_page(token, p)
        out.extend(keep(m) for m in batch)
        if p % 20 == 0:
            print(f"  page {p} ({len(out)} matches)")
        if len(batch) < 100:
            print(f"  reached end at page {p}")
            break
        time.sleep(1.1)  # stay under 60/min burst

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(out))
    print(f"Saved {len(out)} matches to {CACHE}")


if __name__ == "__main__":
    main()
