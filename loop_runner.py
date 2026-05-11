#!/usr/bin/env python3
"""
loop_runner.py — autonomous delivery loop dispatcher
====================================================

Watches the data lake for trigger conditions declared in the
<delivery_loop> block of builders-program.xml. When a trigger fires:

  - autonomous edges → call BuildersRegistry.openBounty() directly
  - coe-gated edges  → post a 'coe_pending_v1' record + alert COE channel

This is the piece that makes the roadmap deliver itself. Every shipped
delivery whose <generates_loop> wires up here causes the next batch of
bounties to materialize without human triage.

Spec: ../BUILDERS_PROGRAM_GOVERNANCE.md §4
Roadmap: ../builders-program.xml > delivery_loop

Environment:
  TAIFOON_DATA_LAKE_ROOT  /root/taifoon-intel-data
  TAIFOON_REGISTRY_ADDR   0x… BuildersRegistry on devnet
  TAIFOON_RPC_URL         https://rpc.taifoon.dev
  TAIFOON_OPERATOR_KEY    hex private key for the oracle role
  TAIFOON_COE_WEBHOOK     URL for COE-gate alerts (Slack / Discord / email)

Usage:
  python loop_runner.py --watch           # default: poll every 60s
  python loop_runner.py --once            # single pass, exit
  python loop_runner.py --simulate <edge> # dry-run a single edge with mock input
"""
from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import logging
import os
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

THIS_DIR  = Path(__file__).resolve().parent
REPO_ROOT = THIS_DIR.parent
_local_roadmap = THIS_DIR / "builders-program.xml"
ROADMAP_XML = _local_roadmap if _local_roadmap.exists() else REPO_ROOT / "builders-program.xml"
DATA_LAKE   = Path(os.environ.get("TAIFOON_DATA_LAKE_ROOT", "/root/taifoon-intel-data"))

# In-process sentinel — production stores this on grid chain to dedupe
SEEN_OUTPUTS = THIS_DIR / "loop_state" / "seen_outputs.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [loop-runner] %(levelname)s %(message)s")
log = logging.getLogger(__name__)


# ─── Edge model ──────────────────────────────────────────────────────────

@dataclass
class LoopEdge:
    id: str
    name: str
    source_delivery: str
    output_kind: str
    generates: str
    automation: str          # "autonomous" | "semi-autonomous"
    coe_gate: bool
    sla_to_publish_hours: int
    funding_policy: str | None = None


def _txt(el, tag: str, default: str = "") -> str:
    found = el.find(tag)
    return (found.text.strip() if (found is not None and found.text) else default)


def parse_edges() -> list[LoopEdge]:
    tree = ET.parse(ROADMAP_XML)
    out: list[LoopEdge] = []
    for el in tree.findall(".//delivery_loop/edge"):
        out.append(LoopEdge(
            id              = el.attrib["id"],
            name            = _txt(el, "name"),
            source_delivery = _txt(el, "source_delivery"),
            output_kind     = _txt(el, "output"),
            generates       = _txt(el, "generates"),
            automation      = _txt(el, "automation", "autonomous"),
            coe_gate        = _txt(el, "coe_gate", "false").lower() == "true",
            sla_to_publish_hours = int(_txt(el, "sla_to_publish_hours", "24") or 24),
            funding_policy  = _txt(el, "funding_policy") or None,
        ))
    return out


# ─── Detection — map edge → trigger source on disk ───────────────────────

def detect_triggers(edge: LoopEdge) -> Iterable[dict]:
    """
    Returns an iterator of trigger payloads. Each payload becomes one
    auto-generated delivery. Production wires these to live event streams
    (DA-API, telemetry-harness, anomaly-scanner). Bootstrap reads JSON
    files from the data lake.
    """
    sources = {
        "loop-1-anomaly-to-fix":            DATA_LAKE / "anomaly_events_v1.jsonl",
        "loop-2-protocol-upgrade-to-refresh": DATA_LAKE / "upgrade_events_v1.jsonl",
        "loop-3-perf-regression-to-bounty":   DATA_LAKE / "regression_events_v1.jsonl",
        "loop-4-skill-extraction":            DATA_LAKE / "skill_candidates_v1.jsonl",
        "loop-5-reviewer-evolution":          DATA_LAKE / "inconclusive_patterns_v1.jsonl",
        "loop-6-revenue-to-treasury-to-bounties": DATA_LAKE / "treasury_state_v1.json",
    }
    src = sources.get(edge.id)
    if not src or not src.exists():
        return iter([])
    if src.suffix == ".json":
        try:
            return iter([json.loads(src.read_text())])
        except Exception as e:
            log.warning("[%s] failed to parse %s: %s", edge.id, src, e)
            return iter([])
    # JSONL
    def _rows():
        with src.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except Exception as e:
                    log.warning("[%s] bad row in %s: %s", edge.id, src, e)
    return _rows()


def trigger_hash(edge_id: str, payload: dict) -> str:
    """Deterministic dedupe key."""
    h = hashlib.sha256()
    h.update(edge_id.encode())
    h.update(json.dumps(payload, sort_keys=True).encode())
    return h.hexdigest()


# ─── Action — emit autonomous bounty or COE-pending record ───────────────

def open_bounty_onchain(bounty_id: str, tier: str, gap_ref: str, upfront_foon: int, share_bps: int) -> str | None:
    addr = os.environ.get("TAIFOON_REGISTRY_ADDR")
    rpc  = os.environ.get("TAIFOON_RPC_URL")
    if not addr or not rpc:
        log.info("[onchain stub] openBounty(%s, %s, %s, upfront=%d, share_bps=%d)", bounty_id, tier, gap_ref, upfront_foon, share_bps)
        return None
    log.info("[onchain stub] would call BuildersRegistry@%s.openBounty(%s, %s, %s, %d, %d) on %s",
             addr, bounty_id, tier, gap_ref, upfront_foon, share_bps, rpc)
    return None


def post_coe_alert(edge: LoopEdge, payload: dict) -> None:
    webhook = os.environ.get("TAIFOON_COE_WEBHOOK")
    body = {
        "edge":        edge.id,
        "edge_name":   edge.name,
        "automation":  edge.automation,
        "coe_gate":    edge.coe_gate,
        "payload":     payload,
        "ts":          int(time.time()),
    }
    if not webhook:
        log.info("[coe stub] would alert webhook with %s", json.dumps(body)[:300])
        return
    try:
        req = urllib.request.Request(
            webhook,
            data=json.dumps(body).encode(),
            headers={"content-type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5).read()
    except Exception as e:
        log.warning("coe webhook failed: %s", e)


# ─── Tier mapping for each edge ──────────────────────────────────────────

TIER_REWARDS = {
    "FLAGSHIP": (25000, 1200),
    "HIGH":     (5000,  800),
    "MEDIUM":   (2000,  800),
    "LOW":      (500,   800),
    "PLATFORM": (10000, 500),
}


def derive_bounty_from_payload(edge: LoopEdge, payload: dict) -> tuple[str, str, str, int, int] | None:
    """Returns (bounty_id, tier, gap_ref, upfront_foon, share_bps) or None."""
    if edge.id == "loop-1-anomaly-to-fix":
        sev  = payload.get("severity", "MEDIUM").upper()
        prot = payload.get("protocol", "unknown")
        bid  = f"auto-fix-{prot}-{int(payload.get('timestamp', time.time()))}"
        gap  = f"anomaly:{prot}:{payload.get('observed_divergence', 'unknown')[:64]}"
        upf, share = TIER_REWARDS.get(sev, TIER_REWARDS["MEDIUM"])
        return bid, sev, gap, upf, share

    if edge.id == "loop-2-protocol-upgrade-to-refresh":
        prot = payload.get("protocol", "unknown")
        bid  = f"auto-refresh-{prot}-{payload.get('new_version', 'v?')}"
        gap  = f"upgrade:{prot}:{payload.get('new_version', 'v?')}"
        return bid, "MEDIUM", gap, *TIER_REWARDS["MEDIUM"]

    if edge.id == "loop-3-perf-regression-to-bounty":
        ad = payload.get("adapter_id", "unknown")
        bid = f"auto-perf-{ad}-{int(payload.get('started_at', time.time()))}"
        gap = f"regression:{ad}:p95+{payload.get('p95_delta_ms', '?')}ms"
        return bid, "LOW", gap, *TIER_REWARDS["LOW"]

    if edge.id == "loop-5-reviewer-evolution":
        scope = payload.get("scope_gap_description", "unknown")[:64]
        bid   = f"auto-reviewer-{int(time.time())}"
        gap   = f"reviewer-scope:{scope}"
        return bid, "PLATFORM", gap, *TIER_REWARDS["PLATFORM"]

    return None


# ─── Loop body ───────────────────────────────────────────────────────────

def load_seen() -> set[str]:
    if not SEEN_OUTPUTS.exists():
        return set()
    try:
        return set(json.loads(SEEN_OUTPUTS.read_text()))
    except Exception:
        return set()


def save_seen(seen: set[str]) -> None:
    SEEN_OUTPUTS.parent.mkdir(parents=True, exist_ok=True)
    SEEN_OUTPUTS.write_text(json.dumps(sorted(seen)))


def run_once(edges: list[LoopEdge]) -> int:
    seen = load_seen()
    fired = 0
    for edge in edges:
        for payload in detect_triggers(edge):
            key = trigger_hash(edge.id, payload)
            if key in seen:
                continue
            seen.add(key)

            if edge.coe_gate:
                log.info("[%s] COE-gate fired — payload routed to COE alert", edge.id)
                post_coe_alert(edge, payload)
            else:
                derived = derive_bounty_from_payload(edge, payload)
                if not derived:
                    log.warning("[%s] no derivation rule — sending to COE", edge.id)
                    post_coe_alert(edge, payload)
                    continue
                bid, tier, gap, upf, share = derived
                log.info("[%s] auto-opening bounty %s (tier=%s)", edge.id, bid, tier)
                open_bounty_onchain(bid, tier, gap, upf, share)
            fired += 1
    save_seen(seen)
    return fired


def watch_loop(interval_s: int) -> None:
    edges = parse_edges()
    log.info("loaded %d loop edges from %s", len(edges), ROADMAP_XML)
    while True:
        n = run_once(edges)
        if n:
            log.info("fired %d edges this pass", n)
        time.sleep(interval_s)


def simulate(edge_id: str) -> int:
    """Mocks a single edge with a synthetic payload for smoke-testing."""
    edges = {e.id: e for e in parse_edges()}
    if edge_id not in edges:
        log.error("unknown edge %s; known=%s", edge_id, sorted(edges))
        return 1
    payload = {
        "loop-1-anomaly-to-fix": {"protocol": "across", "severity": "HIGH", "observed_divergence": "fee_bps off by 12", "timestamp": int(time.time())},
        "loop-2-protocol-upgrade-to-refresh": {"protocol": "wormhole", "new_version": "v3", "breaking_change_flag": True},
        "loop-3-perf-regression-to-bounty": {"adapter_id": "across-v3-fill", "p95_delta_ms": 120, "started_at": int(time.time())},
        "loop-5-reviewer-evolution": {"scope_gap_description": "Sui chain fixtures incomplete", "frequency": 7},
    }.get(edge_id, {})
    edge = edges[edge_id]
    log.info("simulating %s with payload=%s", edge_id, payload)
    if edge.coe_gate:
        post_coe_alert(edge, payload)
    else:
        derived = derive_bounty_from_payload(edge, payload)
        if derived:
            bid, tier, gap, upf, share = derived
            open_bounty_onchain(bid, tier, gap, upf, share)
    return 0


# ─── CLI ─────────────────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="loop_runner")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--watch",    action="store_true", help="poll continuously")
    g.add_argument("--once",     action="store_true", help="single pass, exit")
    g.add_argument("--simulate", metavar="EDGE", help="dry-run a single edge with mock payload")
    p.add_argument("--interval", type=int, default=60, help="watch interval seconds")
    args = p.parse_args(argv)

    if args.simulate:
        return simulate(args.simulate)
    if args.once:
        n = run_once(parse_edges())
        log.info("ran once: %d fired", n)
        return 0
    if args.watch:
        watch_loop(args.interval)
        return 0
    p.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
