"""Train & backtest CS2 win-probability models on cached PandaScore history.

Builds features chronologically with NO leakage (features come from pre-match
state only; state is updated AFTER the row is recorded), then compares:
  - Elo baseline
  - Logistic Regression
  - Gradient Boosting (HistGradientBoosting)
with a time-aware train/test split and calibration report.

Usage: python -I model.py
"""
import json, math
from pathlib import Path
from collections import defaultdict, deque
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import log_loss, brier_score_loss, accuracy_score

HERE = Path(__file__).resolve().parent
CACHE = HERE / "data" / "matches.json"

K = 32
START = 1500
FORM_N = 10
TIER = {"s": 5, "a": 4, "b": 3, "c": 2, "d": 1}
TEST_FRAC = 0.30     # last 30% chronologically = held-out test
MIN_GAMES = 5        # "warm": both teams have >= this many prior games


def expected(ra, rb):
    return 1.0 / (1.0 + 10 ** ((rb - ra) / 400))


def build():
    raw = json.loads(CACHE.read_text())
    # decisive Team-vs-Team only, chronological
    ms = []
    for m in raw:
        if m.get("draw") or m.get("forfeit") or not m.get("winner_id"):
            continue
        opps = m.get("opponents") or []
        if len(opps) != 2 or any(o.get("type") != "Team" or not o.get("id") for o in opps):
            continue
        t = m.get("scheduled_at") or m.get("begin_at")
        if not t:
            continue
        ms.append({**m, "t": t})
    ms.sort(key=lambda x: x["t"])

    elo = defaultdict(lambda: START)
    games = defaultdict(int)
    form = defaultdict(lambda: deque(maxlen=FORM_N))  # recent 1/0
    streak = defaultdict(int)
    last_date = {}
    h2h = defaultdict(int)  # (winner_id, loser_id) -> count

    rows = []
    for m in ms:
        a, b = m["opponents"][0]["id"], m["opponents"][1]["id"]
        ra, rb = elo[a], elo[b]
        date = pd.to_datetime(m["t"])

        def winrate(team):
            d = form[team]
            return sum(d) / len(d) if d else 0.5

        def rest(team):
            if team not in last_date:
                return 7.0
            return min((date - last_date[team]).total_seconds() / 86400, 30.0)

        bo = m.get("number_of_games") or 1
        tier = TIER.get((m.get("serie_tier") or "").lower(), 0)
        won_a = 1 if m["winner_id"] == a else 0

        rows.append({
            "t": m["t"],
            "elo_diff": ra - rb,
            "elo_prob": expected(ra, rb),
            "form_diff": winrate(a) - winrate(b),
            "streak_diff": streak[a] - streak[b],
            "rest_diff": rest(a) - rest(b),
            "h2h_diff": h2h[(a, b)] - h2h[(b, a)],
            "games_min": min(games[a], games[b]),
            "exp_diff": games[a] - games[b],
            "bo": bo,
            "tier": tier,
            "y": won_a,
        })

        # ---- update state AFTER recording the row (no leakage) ----
        pa = expected(ra, rb)
        elo[a] = ra + K * (won_a - pa)
        elo[b] = rb + K * ((1 - won_a) - (1 - pa))
        games[a] += 1; games[b] += 1
        form[a].append(won_a); form[b].append(1 - won_a)
        streak[a] = max(1, streak[a] + 1) if won_a else min(-1, streak[a] - 1)
        streak[b] = max(1, streak[b] + 1) if not won_a else min(-1, streak[b] - 1)
        last_date[a] = last_date[b] = date
        h2h[(a, b) if won_a else (b, a)] += 1

    return pd.DataFrame(rows)


def report(name, y, p):
    acc = accuracy_score(y, (p >= 0.5).astype(int))
    ll = log_loss(y, p, labels=[0, 1])
    br = brier_score_loss(y, p)
    print(f"{name:22} acc={acc*100:5.1f}%   logloss={ll:.4f}   brier={br:.4f}")
    return acc, ll, br


def calibration(name, y, p, bins=10):
    print(f"\nCalibration — {name} (predicted vs actual win rate):")
    df = pd.DataFrame({"y": y.values, "p": p})
    df["bucket"] = (df["p"] * bins).clip(0, bins - 1).astype(int)
    for b, g in df.groupby("bucket"):
        lo, hi = b / bins, (b + 1) / bins
        print(f"  {lo:.1f}-{hi:.1f}: predicted~{g.p.mean()*100:4.1f}%  actual={g.y.mean()*100:5.1f}%  (n={len(g)})")


def main():
    if not CACHE.exists():
        raise SystemExit("No cache. Run fetch_history.py first.")
    df = build()
    print(f"{len(df)} decisive matches, {df.t.min()[:10]} -> {df.t.max()[:10]}")

    feats = ["elo_diff", "form_diff", "streak_diff", "rest_diff", "h2h_diff",
             "games_min", "exp_diff", "bo", "tier"]

    split = int(len(df) * (1 - TEST_FRAC))
    train, test = df.iloc[:split], df.iloc[split:]
    # fair eval on "warm" matchups (both teams have history)
    warm = test[test.games_min >= MIN_GAMES]
    print(f"train={len(train)}  test={len(test)}  warm-test={len(warm)}\n")

    Xtr, ytr = train[feats].values, train["y"]
    Xte, yte = warm[feats].values, warm["y"]

    print("=== Held-out test (warm matchups) ===")
    report("Elo baseline", yte, warm["elo_prob"].values)

    lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    lr.fit(Xtr, ytr)
    p_lr = lr.predict_proba(Xte)[:, 1]
    report("Logistic Regression", yte, p_lr)

    gb = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05,
                                        max_depth=4, l2_regularization=1.0,
                                        early_stopping=True, random_state=0)
    gb.fit(Xtr, ytr)
    p_gb = gb.predict_proba(Xte)[:, 1]
    report("Gradient Boosting", yte, p_gb)

    # logistic-regression coefficients (interpretability)
    coefs = lr.named_steps["logisticregression"].coef_[0]
    print("\nLogistic Regression weights (standardized; sign = helps team A):")
    for f, c in sorted(zip(feats, coefs), key=lambda x: -abs(x[1])):
        print(f"  {f:12} {c:+.3f}")

    calibration("Gradient Boosting", yte, p_gb)


if __name__ == "__main__":
    main()
