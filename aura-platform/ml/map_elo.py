"""Map-level Elo vs match-level Elo, head-to-head on the same test split.

Match-level: one rating per team, updated per match (win/loss of the series).
Map-level:   one rating per team, updated per MAP won/lost; the match win
             probability is derived from the per-map probability via the
             binomial (chance of winning a majority of `number_of_games`).

Both are computed in one chronological pass with no leakage, then scored on
the held-out recent portion (warm matchups only).

Usage: python -I map_elo.py
"""
import json, math
from pathlib import Path
from collections import defaultdict
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, brier_score_loss, accuracy_score

HERE = Path(__file__).resolve().parent
CACHE = HERE / "data" / "matches.json"

START = 1500
K_MATCH = 32
K_MAP = 24           # more updates per map, so a slightly smaller step
TEST_FRAC = 0.30
MIN_GAMES = 5        # warm: both teams have >= this many prior matches


def expected(ra, rb):
    return 1.0 / (1.0 + 10 ** ((rb - ra) / 400))


def match_prob_from_map(p, bo):
    """P(team A wins a best-of-`bo`) given per-map win prob p (iid maps)."""
    need = bo // 2 + 1
    return sum(math.comb(bo, k) * p**k * (1 - p)**(bo - k) for k in range(need, bo + 1))


def main():
    raw = json.loads(CACHE.read_text())
    ms = []
    for m in raw:
        if m.get("draw") or m.get("forfeit") or not m.get("winner_id"):
            continue
        opps = m.get("opponents") or []
        if len(opps) != 2 or any(o.get("type") != "Team" or not o.get("id") for o in opps):
            continue
        t = m.get("scheduled_at") or m.get("begin_at")
        if t:
            ms.append({**m, "t": t})
    ms.sort(key=lambda x: x["t"])

    me = defaultdict(lambda: START)   # match-level elo
    mp = defaultdict(lambda: START)   # map-level elo
    games = defaultdict(int)          # match count per team (for warm filter)

    rows = []
    for m in ms:
        a, b = m["opponents"][0]["id"], m["opponents"][1]["id"]
        won_a = 1 if m["winner_id"] == a else 0
        bo = m.get("number_of_games") or (len(m.get("games") or []) or 1)

        # --- predictions from PRE-match state ---
        p_match = expected(me[a], me[b])
        p_map1 = expected(mp[a], mp[b])
        p_match_from_map = match_prob_from_map(p_map1, max(bo, 1))

        rows.append({
            "t": m["t"], "y": won_a, "bo": bo,
            "games_min": min(games[a], games[b]),
            "p_matchelo": p_match,
            "p_mapelo": p_match_from_map,
        })

        # --- update match-level elo ---
        pa = expected(me[a], me[b])
        me[a] += K_MATCH * (won_a - pa)
        me[b] += K_MATCH * ((1 - won_a) - (1 - pa))

        # --- update map-level elo per finished map ---
        for g in (m.get("games") or []):
            w = g.get("winner_id")
            if not g.get("finished") or w not in (a, b):
                continue
            wa = 1 if w == a else 0
            q = expected(mp[a], mp[b])
            mp[a] += K_MAP * (wa - q)
            mp[b] += K_MAP * ((1 - wa) - (1 - q))

        games[a] += 1; games[b] += 1

    df = pd.DataFrame(rows)
    split = int(len(df) * (1 - TEST_FRAC))
    test = df.iloc[split:]
    warm = test[test.games_min >= MIN_GAMES]
    print(f"{len(df)} matches, {df.t.min()[:10]} -> {df.t.max()[:10]}")
    print(f"warm-test matchups: {len(warm)}\n")

    def report(name, p):
        y = warm["y"]
        acc = accuracy_score(y, (p >= 0.5).astype(int))
        ll = log_loss(y, p, labels=[0, 1])
        br = brier_score_loss(y, p)
        print(f"{name:26} acc={acc*100:5.1f}%   logloss={ll:.4f}   brier={br:.4f}")

    print("=== Held-out test (warm matchups) ===")
    report("Match-level Elo", warm["p_matchelo"].values)
    report("Map-level Elo (binomial)", warm["p_mapelo"].values)

    # blend them (often the best of both)
    blend = 0.5 * warm["p_matchelo"].values + 0.5 * warm["p_mapelo"].values
    report("Blend (50/50)", blend)


if __name__ == "__main__":
    main()
