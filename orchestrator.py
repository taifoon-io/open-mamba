#!/usr/bin/env python3
"""
open-mamba orchestrator
=======================

Reads bounties.xml + reviewers.xml, watches submissions/, dispatches each
submission to its assigned reviewer agents, collects signed verdicts, and
calls BuildersRegistry.submitVerdict() on each verdict.

Spec: ../BUILDERS_PROGRAM.md  §1 (Pipeline)
Schemas: verdict_schemas/reviewer_verdict_v1.json
Reviewers: reviewers.xml
Bounties: bounties.xml (same dir, or ../bounties.xml in monorepo layout)

This is a reference implementation. Production runs inside a confidential-
compute enclave (Intel SGX / AMD SEV-SNP, TBD), with reviewer keys held in
HSM-backed wallets.

Environment:
  TAIFOON_REGISTRY_ADDR      0x… BuildersRegistry on devnet
  TAIFOON_RPC_URL            https://rpc.taifoon.dev
  TAIFOON_ORACLE_KEY         hex private key for the oracle role
  TAIFOON_REPLAY_SETS_ROOT   /root/taifoon-intel-data/replay-sets/

Usage:
  python orchestrator.py --watch ./submissions/
  python orchestrator.py --dispatch <bounty_id> <contributor_wallet>
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import logging
import os
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

THIS_DIR    = Path(__file__).resolve().parent
# bounties.xml lives alongside orchestrator.py when run from this repo directly;
# fall back to the parent when run from within the spinner monorepo.
_local_bounties = THIS_DIR / "bounties.xml"
BOUNTIES_XML  = _local_bounties if _local_bounties.exists() else THIS_DIR.parent / "bounties.xml"
REVIEWERS_XML = THIS_DIR / "reviewers.xml"
SUBMISSIONS   = THIS_DIR / "submissions"
VERDICTS_OUT  = THIS_DIR / "verdicts"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
)
log = logging.getLogger("orchestrator")


# ─── Schemas ──────────────────────────────────────────────────────────

@dataclass
class Verdict:
    schema_version: str
    reviewer_id: str
    reviewer_version: str
    bounty_id: str
    submission_hash: str
    contributor_wallet: str
    verdict: str               # pass | fail | inconclusive
    reason_code: str
    replay_block_set: str
    signed_at: int
    signature: str
    reason_detail: str = ""
    metrics: dict[str, Any] | None = None


# ─── Registry parsing ─────────────────────────────────────────────────

def load_bounties() -> dict[str, dict]:
    tree = ET.parse(BOUNTIES_XML)
    out = {}
    for b in tree.getroot().findall("bounty"):
        bid = b.attrib["id"]
        reviewers_el = b.find("reviewers")
        cat = b.attrib.get("category", "")
        explicit = []
        if reviewers_el is not None and reviewers_el.text:
            explicit = [s.strip() for s in reviewers_el.text.split(",") if s.strip()]
        out[bid] = {
            "tier":     b.attrib["tier"],
            "category": cat,
            "status":   b.attrib["status"],
            "reviewers": explicit,
        }
    return out


def load_reviewers() -> tuple[dict[str, dict], dict[str, tuple[str, str]]]:
    tree = ET.parse(REVIEWERS_XML)
    root = tree.getroot()
    reviewers = {}
    for r in root.findall("reviewer"):
        slug = r.attrib["slug"]
        reviewers[slug] = {
            "stake_foon":   int(r.attrib.get("stake_foon", "0")),
            "status":       r.attrib.get("status", "bootstrap"),
            "perf_budget_p95_ms": int((r.findtext("perf_budget_p95_ms") or "100")),
            "fixture_threshold":  int((r.findtext("fixture_threshold") or "1000")),
            "reference_block_set": (r.findtext("reference_block_set") or "").strip(),
            "approves":     (r.findtext("approves") or "").strip(),
            "scope":        (r.findtext("scope") or "").strip(),
        }
    defaults = {}
    for d in root.findall(".//defaults/category"):
        defaults[d.attrib["id"]] = (
            d.attrib["primary"],
            d.attrib.get("secondary", ""),
        )
    return reviewers, defaults


def resolve_reviewers(bounty: dict, defaults: dict) -> list[str]:
    if bounty["reviewers"]:
        return bounty["reviewers"]
    cat = bounty["category"]
    if cat in defaults:
        primary, secondary = defaults[cat]
        out = [s.strip() for s in primary.split(",") if s.strip()]
        if secondary:
            out += [s.strip() for s in secondary.split(",") if s.strip()]
        return out
    return ["evm-replay", "schema-conformer"]


# ─── Submission loading ───────────────────────────────────────────────

def submission_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return "0x" + h.hexdigest()


def discover_submissions() -> list[tuple[str, str, Path]]:
    """Returns [(bounty_id, contributor_wallet, tarball_path), ...]"""
    if not SUBMISSIONS.exists():
        return []
    out = []
    for tarball in SUBMISSIONS.rglob("*.tar.gz"):
        # Convention: submissions/<bounty_id>/<wallet>/<commit_sha>.tar.gz
        try:
            wallet     = tarball.parent.name
            bounty_id  = tarball.parent.parent.name
        except IndexError:
            continue
        out.append((bounty_id, wallet, tarball))
    return out


# ─── Reviewer dispatch ────────────────────────────────────────────────

def load_reviewer_agent(slug: str):
    """
    Loads a reviewer agent. Convention: agents/<slug-with-underscores>/agent.py
    exposes `review(submission_path: Path, bounty: dict, reviewer_meta: dict)
    -> Verdict`.
    """
    module_name = f"agents.{slug.replace('-', '_')}.agent"
    try:
        mod = importlib.import_module(module_name)
    except ImportError as e:
        log.warning("reviewer agent %s not found (%s) — using stub", slug, e)
        return _stub_reviewer(slug)
    if not hasattr(mod, "review"):
        log.warning("reviewer agent %s has no review() — using stub", slug)
        return _stub_reviewer(slug)
    return mod.review


def _stub_reviewer(slug: str):
    def review(submission_path, bounty, meta):
        log.info("[stub:%s] reviewing %s", slug, submission_path)
        return Verdict(
            schema_version    = "reviewer_verdict_v1",
            reviewer_id       = slug,
            reviewer_version  = "0.0.0",
            bounty_id         = bounty["id"],
            submission_hash   = submission_hash(submission_path),
            contributor_wallet= bounty["contributor"],
            verdict           = "inconclusive",
            reason_code       = "INSUFFICIENT_FIXTURES",
            reason_detail     = f"stub reviewer {slug} not implemented",
            replay_block_set  = meta.get("reference_block_set", ""),
            signed_at         = int(time.time()),
            signature         = "0x00",
        )
    return review


def write_verdict(v: Verdict) -> Path:
    VERDICTS_OUT.mkdir(parents=True, exist_ok=True)
    out = VERDICTS_OUT / f"{v.bounty_id}_{v.contributor_wallet}_{v.reviewer_id}.json"
    with out.open("w") as f:
        json.dump(asdict(v), f, indent=2)
    log.info("verdict written: %s [%s] %s", out.name, v.verdict, v.reason_code)
    return out


# ─── On-chain submission ──────────────────────────────────────────────

def submit_verdict_onchain(v: Verdict) -> str | None:
    """
    Stub. Production implementation calls
    BuildersRegistry.submitVerdict(bountyId, contributor, reviewerSlug,
                                   verdict, reasonCode) signed by oracle key.
    """
    rpc = os.environ.get("TAIFOON_RPC_URL")
    addr = os.environ.get("TAIFOON_REGISTRY_ADDR")
    if not rpc or not addr:
        log.info("on-chain submission skipped (TAIFOON_RPC_URL / TAIFOON_REGISTRY_ADDR not set)")
        return None

    # Production: web3.py call here. Stubbed to keep deps minimal.
    log.info("[on-chain stub] would call %s.submitVerdict(%s, %s, %s, %s, %s)",
             addr, v.bounty_id, v.contributor_wallet,
             v.reviewer_id, v.verdict, v.reason_code)
    return None


# ─── Orchestration core ───────────────────────────────────────────────

def dispatch_one(bounty_id: str, wallet: str, tarball: Path) -> list[Verdict]:
    bounties = load_bounties()
    if bounty_id not in bounties:
        log.error("bounty %s not in bounties.xml", bounty_id)
        return []
    reviewers_meta, defaults = load_reviewers()

    bounty = dict(bounties[bounty_id])
    bounty["id"] = bounty_id
    bounty["contributor"] = wallet

    assigned = resolve_reviewers(bounty, defaults)
    log.info("dispatching bounty=%s wallet=%s reviewers=%s", bounty_id, wallet, assigned)

    verdicts: list[Verdict] = []
    for slug in assigned:
        meta = reviewers_meta.get(slug, {})
        review_fn = load_reviewer_agent(slug)
        try:
            v = review_fn(tarball, bounty, meta)
        except Exception as e:
            log.exception("reviewer %s crashed: %s", slug, e)
            v = Verdict(
                schema_version    = "reviewer_verdict_v1",
                reviewer_id       = slug,
                reviewer_version  = "0.0.0",
                bounty_id         = bounty_id,
                submission_hash   = submission_hash(tarball),
                contributor_wallet= wallet,
                verdict           = "inconclusive",
                reason_code       = "ENCLAVE_FAILURE",
                reason_detail     = str(e)[:500],
                replay_block_set  = meta.get("reference_block_set", ""),
                signed_at         = int(time.time()),
                signature         = "0x00",
            )
        write_verdict(v)
        submit_verdict_onchain(v)
        verdicts.append(v)
    return verdicts


def watch_loop(interval_s: int = 30) -> None:
    seen: set[str] = set()
    log.info("watching %s every %ds", SUBMISSIONS, interval_s)
    while True:
        for (bid, wallet, tarball) in discover_submissions():
            key = f"{bid}/{wallet}/{tarball.name}"
            if key in seen:
                continue
            seen.add(key)
            try:
                dispatch_one(bid, wallet, tarball)
            except Exception as e:
                log.exception("dispatch failed for %s: %s", key, e)
        time.sleep(interval_s)


# ─── CLI ──────────────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="orchestrator")
    sub = p.add_subparsers(dest="cmd", required=True)

    w = sub.add_parser("watch", help="watch submissions/ for new uploads")
    w.add_argument("--interval", type=int, default=30)

    d = sub.add_parser("dispatch", help="dispatch a single submission")
    d.add_argument("bounty_id")
    d.add_argument("wallet")
    d.add_argument("tarball")

    l = sub.add_parser("list", help="list bounties + reviewers")

    args = p.parse_args(argv)

    if args.cmd == "watch":
        watch_loop(args.interval)
    elif args.cmd == "dispatch":
        dispatch_one(args.bounty_id, args.wallet, Path(args.tarball))
    elif args.cmd == "list":
        bounties = load_bounties()
        reviewers, _ = load_reviewers()
        print(f"Bounties ({len(bounties)}):")
        for bid, b in bounties.items():
            print(f"  {bid:40s} {b['tier']:10s} {b['status']:10s} cat={b['category']}")
        print(f"\nReviewers ({len(reviewers)}):")
        for slug, r in reviewers.items():
            print(f"  {slug:25s} stake={r['stake_foon']:>7d} status={r['status']:10s}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
