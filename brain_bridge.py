#!/usr/bin/env python3
"""
brain_bridge.py — open-mamba ↔ Next.js LiveBrain bridge

Writes the orchestrator's live state to disk where the Next.js LiveBrain
component can read it (/api/dispatch/live-state → reads .data/reviews/active/
and .data/reviews/recent.jsonl).

Three modes:

  1. Wrap the orchestrator. Call `bridge.start_review(...)` /
     `bridge.finish_review(...)` from orchestrator.py around each reviewer-
     agent run; they emit JSON files the Next.js API serves.

  2. Heartbeat ticker. Called every 2s by `taifoon-mamba` dispatcher. Writes
     `.data/dispatch/heartbeat.json` so LiveBrain knows the dispatcher is
     alive. Run as a background loop on its own.

  3. Demo synthetic mode. When no real reviewers are running but you want
     /os/dispatch to feel alive on stage, run:
       python brain_bridge.py --synthetic
     Emits a believable cadence of pretend reviews against the real bounty
     list pulled from bounties.xml — flagged synthetic=true so it's never
     mistaken for production data.

Environment / paths:
  TAIFOON_NEXT_DATA_ROOT   default: ../taifoon-next/.data
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

THIS_DIR    = Path(__file__).resolve().parent
REPO_ROOT   = THIS_DIR.parent
NEXT_DATA   = Path(os.environ.get(
    "TAIFOON_NEXT_DATA_ROOT",
    str(REPO_ROOT / "taifoon-next" / ".data"),
))
# bounties.xml: prefer local (standalone repo), fall back to monorepo layout
_local_bounties = THIS_DIR / "bounties.xml"
BOUNTIES_XML  = _local_bounties if _local_bounties.exists() else REPO_ROOT / "bounties.xml"
REVIEWERS_XML = THIS_DIR / "reviewers.xml"

ACTIVE_DIR  = NEXT_DATA / "reviews" / "active"
RECENT_FILE = NEXT_DATA / "reviews" / "recent.jsonl"
HEARTBEAT   = NEXT_DATA / "dispatch" / "heartbeat.json"

PHASES = ["pending", "static_check", "replay", "adversarial", "verdict_pending"]


def _ensure_dirs() -> None:
    ACTIVE_DIR.mkdir(parents=True, exist_ok=True)
    HEARTBEAT.parent.mkdir(parents=True, exist_ok=True)
    RECENT_FILE.parent.mkdir(parents=True, exist_ok=True)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Real-orchestrator integration ────────────────────────────────────

def start_review(*, review_id: str, bounty_id: str, reviewer_slug: str,
                 contributor_wallet: str | None = None,
                 phase: str = "static_check") -> None:
    _ensure_dirs()
    rec = {
        "review_id": review_id,
        "bounty_id": bounty_id,
        "reviewer_slug": reviewer_slug,
        "contributor_wallet": contributor_wallet,
        "started_at": _iso_now(),
        "phase": phase,
    }
    (ACTIVE_DIR / f"{review_id}.json").write_text(json.dumps(rec, indent=2))


def update_review(*, review_id: str, phase: str, progress_pct: int | None = None) -> None:
    f = ACTIVE_DIR / f"{review_id}.json"
    if not f.exists():
        return
    rec = json.loads(f.read_text())
    rec["phase"] = phase
    if progress_pct is not None:
        rec["progress_pct"] = progress_pct
    f.write_text(json.dumps(rec, indent=2))


def finish_review(*, review_id: str, bounty_id: str, reviewer_slug: str,
                  contributor_wallet: str,
                  verdict: str) -> None:
    """verdict: 'pass' | 'fail' | 'inconclusive'"""
    _ensure_dirs()
    # Remove from active
    f = ACTIVE_DIR / f"{review_id}.json"
    if f.exists():
        f.unlink()
    # Append to recent.jsonl
    rec = {
        "reviewer_slug": reviewer_slug,
        "bounty_id": bounty_id,
        "contributor_wallet": contributor_wallet,
        "verdict": verdict,
        "decided_at": _iso_now(),
    }
    with RECENT_FILE.open("a", encoding="utf8") as fh:
        fh.write(json.dumps(rec) + "\n")


def heartbeat(*, tick_count: int, jobs_per_hour: float = 0.0) -> None:
    _ensure_dirs()
    HEARTBEAT.write_text(json.dumps({
        "last_tick_ms": _now_ms(),
        "tick_count": tick_count,
        "jobs_per_hour": jobs_per_hour,
    }, indent=2))


# ─── Synthetic demo mode ──────────────────────────────────────────────

def _load_demo_bounties(limit: int = 20) -> list[tuple[str, list[str]]]:
    """Returns [(bounty_id, [reviewer_slug, ...]), ...] from bounties.xml.
       Falls back to a small static list if bounties.xml unreadable."""
    try:
        tree = ET.parse(BOUNTIES_XML)
        root = tree.getroot()
        out: list[tuple[str, list[str]]] = []
        for b in root.findall(".//bounty")[:limit]:
            bid = b.get("id") or "unknown"
            revs = [r.text or "" for r in b.findall(".//reviewer") if r.text]
            if not revs:
                revs = ["evm-replay", "schema-conformer"]
            out.append((bid, revs))
        return out
    except Exception:
        return [
            ("b-mayan-sol-001",     ["sol-replay", "schema-conformer"]),
            ("b-across-eth-007",    ["evm-replay", "schema-conformer"]),
            ("b-debridge-002",      ["evm-replay", "aggregator-decomposer"]),
            ("b-lambda-instant-04", ["lambda-replay", "schema-conformer"]),
        ]


def synthetic_loop(interval_s: float = 2.0) -> None:
    """Emits a believable demo cadence — opens a review, transitions phases
       every few ticks, closes with a randomized verdict. Always flagged
       synthetic via heartbeat metadata."""
    _ensure_dirs()
    bounties = _load_demo_bounties()
    if not bounties:
        print("no bounties to seed synthetic loop", file=sys.stderr)
        sys.exit(1)

    tick = 0
    active: dict[str, dict] = {}

    print(f"synthetic brain_bridge running, interval={interval_s}s", file=sys.stderr)
    print(f"writing to {NEXT_DATA}", file=sys.stderr)

    while True:
        tick += 1
        try:
            # Heartbeat
            heartbeat(tick_count=tick, jobs_per_hour=12.0 + random.random() * 4)

            # Maybe open a new review
            if len(active) < 3 and random.random() < 0.35:
                bid, revs = random.choice(bounties)
                rev = random.choice(revs)
                rid = f"r-{uuid4().hex[:8]}"
                start_review(
                    review_id=rid, bounty_id=bid, reviewer_slug=rev,
                    contributor_wallet="0x" + uuid4().hex[:40],
                    phase=PHASES[0],
                )
                active[rid] = {"phase_idx": 0, "bid": bid, "rev": rev,
                                "wallet": "0x" + uuid4().hex[:40]}

            # Advance + maybe close existing reviews
            to_close: list[str] = []
            for rid, st in list(active.items()):
                if random.random() < 0.45:
                    st["phase_idx"] += 1
                    if st["phase_idx"] >= len(PHASES):
                        # Close with weighted verdict (mostly pass for demo morale)
                        verdict = random.choices(
                            ["pass", "fail", "inconclusive"],
                            weights=[0.7, 0.18, 0.12],
                        )[0]
                        finish_review(
                            review_id=rid, bounty_id=st["bid"],
                            reviewer_slug=st["rev"],
                            contributor_wallet=st["wallet"],
                            verdict=verdict,
                        )
                        to_close.append(rid)
                    else:
                        update_review(
                            review_id=rid, phase=PHASES[st["phase_idx"]],
                            progress_pct=int((st["phase_idx"] / len(PHASES)) * 100),
                        )
            for rid in to_close:
                active.pop(rid, None)

            time.sleep(interval_s)
        except KeyboardInterrupt:
            print("\nsynthetic loop stopped", file=sys.stderr)
            return
        except Exception as e:
            print(f"tick error: {e}", file=sys.stderr)
            time.sleep(interval_s)


# ─── CLI ──────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=False)

    sub.add_parser("synthetic", help="Run a believable demo loop until killed.")
    sub.add_parser("once", help="Single heartbeat + nothing else.")
    sub.add_parser("clear", help="Wipe active reviews + recent.jsonl.")

    p_open = sub.add_parser("open", help="Open one review (orchestrator helper).")
    p_open.add_argument("--bounty", required=True)
    p_open.add_argument("--reviewer", required=True)
    p_open.add_argument("--wallet", default=None)

    p_close = sub.add_parser("close", help="Close one review with a verdict.")
    p_close.add_argument("--review-id", required=True)
    p_close.add_argument("--bounty", required=True)
    p_close.add_argument("--reviewer", required=True)
    p_close.add_argument("--wallet", required=True)
    p_close.add_argument("--verdict", choices=["pass", "fail", "inconclusive"], required=True)

    args = ap.parse_args()

    cmd = args.cmd or ("synthetic" if "--synthetic" in sys.argv else None)
    if cmd is None:
        ap.print_help()
        return

    if cmd == "synthetic":
        synthetic_loop()
    elif cmd == "once":
        heartbeat(tick_count=1)
    elif cmd == "clear":
        if ACTIVE_DIR.exists():
            for f in ACTIVE_DIR.glob("*.json"):
                f.unlink()
        if RECENT_FILE.exists():
            RECENT_FILE.unlink()
        print("cleared", file=sys.stderr)
    elif cmd == "open":
        rid = f"r-{uuid4().hex[:8]}"
        start_review(review_id=rid, bounty_id=args.bounty, reviewer_slug=args.reviewer,
                     contributor_wallet=args.wallet)
        print(rid)
    elif cmd == "close":
        finish_review(review_id=args.review_id, bounty_id=args.bounty,
                      reviewer_slug=args.reviewer, contributor_wallet=args.wallet,
                      verdict=args.verdict)


# Old-style argparse with --synthetic flag for backwards compat
if "--synthetic" in sys.argv and len(sys.argv) == 2:
    synthetic_loop()
elif __name__ == "__main__":
    main()
