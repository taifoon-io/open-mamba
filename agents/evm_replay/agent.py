"""
evm-replay reviewer
===================

Replays an EVM-class adapter submission against a fixed historical block
set, diffs the decoded output against the reference, and emits a signed
reviewer_verdict_v1.

This is the reference implementation. Production version hardens:
  - Runs inside an Intel SGX / AMD SEV-SNP enclave so the contributor's
    code is not exposed to the host.
  - Fetches replay set from /root/taifoon-intel-data/replay-sets/evm/v1/
    by content hash, not path.
  - Signs the verdict with an HSM-held key registered on-chain in
    BuildersRegistry.

For bootstrap / local dev this implementation is rule-based: it untars
the submission, attempts to import a Python module named `decoder.py`
exposing `decode_event(log) -> dict`, runs it against a sample of
known-good fixtures from the replay set, and compares output.
"""
from __future__ import annotations

import json
import statistics
import tarfile
import tempfile
import time
from dataclasses import asdict
from importlib import util as importlib_util
from pathlib import Path
from typing import Any

from open_mamba_orchestrator import Verdict, submission_hash  # type: ignore  # see fallback below

REVIEWER_ID      = "evm-replay"
REVIEWER_VERSION = "0.1.0"

# Bootstrap fallback — if running before installing as a package
try:
    from ..orchestrator import Verdict, submission_hash  # type: ignore
except Exception:
    pass


def _load_decoder(extracted_dir: Path):
    """Load the contributor's decoder.py module from the extracted submission."""
    decoder_path = extracted_dir / "decoder.py"
    if not decoder_path.exists():
        raise ImportError(f"decoder.py missing in submission")
    spec = importlib_util.spec_from_file_location("contrib_decoder", decoder_path)
    mod = importlib_util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    if not hasattr(mod, "decode_event"):
        raise AttributeError("decoder.py must expose decode_event(log) -> dict")
    return mod


def _load_fixtures(replay_root: str | Path, bounty_id: str, max_items: int) -> list[dict]:
    """Loads up to max_items reference fixtures for this bounty's chain set."""
    p = Path(replay_root) if replay_root else None
    if not p or not p.exists():
        # Synthetic fallback so the bootstrap pipeline can still smoke-test.
        return [
            {"input": {"chainId": 1, "logIndex": 0, "data": "0x"},
             "expected": {"schema_version": "fill_event_v1", "src_chain": 1}}
        ]
    fixtures: list[dict] = []
    for jf in sorted(p.glob(f"**/{bounty_id}_*.json"))[:max_items]:
        try:
            fixtures.append(json.loads(jf.read_text()))
        except Exception:
            continue
    return fixtures


def _diff(actual: dict, expected: dict) -> tuple[bool, str]:
    """Returns (matched, reason). Required fields must match exactly."""
    required = ["schema_version", "src_chain", "dst_chain", "protocol",
                "asset", "request_ts", "fill_ts"]
    for k in required:
        if expected.get(k) != actual.get(k):
            return False, f"field '{k}' mismatch (expected={expected.get(k)} actual={actual.get(k)})"
    return True, ""


def review(submission_path: Path, bounty: dict, meta: dict) -> Verdict:
    """Entry point called by orchestrator."""
    sub_hash = submission_hash(submission_path)
    replay_root = meta.get("reference_block_set", "")
    fixture_threshold = int(meta.get("fixture_threshold", 1000))
    perf_budget_p95_ms = float(meta.get("perf_budget_p95_ms", 50))

    base = dict(
        schema_version    = "reviewer_verdict_v1",
        reviewer_id       = REVIEWER_ID,
        reviewer_version  = REVIEWER_VERSION,
        bounty_id         = bounty["id"],
        submission_hash   = sub_hash,
        contributor_wallet= bounty["contributor"],
        replay_block_set  = replay_root,
        signed_at         = int(time.time()),
        signature         = "0x00",  # TODO: HSM-signed in prod
    )

    # 1. Extract submission
    with tempfile.TemporaryDirectory() as td:
        try:
            with tarfile.open(submission_path, "r:gz") as t:
                t.extractall(td)
        except Exception as e:
            return Verdict(**base, verdict="fail", reason_code="SCHEMA_INVALID",
                           reason_detail=f"tarball extraction failed: {e}"[:500])

        # 2. Load contributor decoder
        try:
            decoder = _load_decoder(Path(td))
        except Exception as e:
            return Verdict(**base, verdict="fail", reason_code="SCHEMA_INVALID",
                           reason_detail=f"decoder.py load failed: {e}"[:500])

        # 3. Load fixtures
        fixtures = _load_fixtures(replay_root, bounty["id"], max_items=fixture_threshold)
        if len(fixtures) < min(100, fixture_threshold):
            return Verdict(**base, verdict="inconclusive",
                           reason_code="INSUFFICIENT_FIXTURES",
                           reason_detail=f"only {len(fixtures)} fixtures available; need {fixture_threshold}"[:500])

        # 4. Replay + diff
        latencies_ms: list[float] = []
        diverged = 0
        matched = 0
        first_diff_reason = ""
        for fx in fixtures:
            t0 = time.perf_counter()
            try:
                actual = decoder.decode_event(fx["input"])
            except Exception as e:
                return Verdict(**base, verdict="fail", reason_code="REPLAY_DIFF",
                               reason_detail=f"decoder threw: {e}"[:500],
                               metrics={"fixtures_replayed": len(latencies_ms)})
            latencies_ms.append((time.perf_counter() - t0) * 1000)
            ok, why = _diff(actual, fx["expected"])
            if ok:
                matched += 1
            else:
                diverged += 1
                if not first_diff_reason:
                    first_diff_reason = why

        # 5. Performance budget
        p95 = statistics.quantiles(latencies_ms, n=20)[18] if len(latencies_ms) >= 20 else max(latencies_ms or [0])
        metrics = {
            "fixtures_replayed":  len(latencies_ms),
            "matched_count":      matched,
            "diverged_count":     diverged,
            "p50_decode_ms":      statistics.median(latencies_ms) if latencies_ms else 0,
            "p95_decode_ms":      p95,
        }

        if diverged > 0:
            return Verdict(**base, verdict="fail", reason_code="REPLAY_DIFF",
                           reason_detail=f"{diverged}/{len(fixtures)} diverged; first: {first_diff_reason}"[:500],
                           metrics=metrics)
        if p95 > perf_budget_p95_ms:
            return Verdict(**base, verdict="fail", reason_code="PERF_BUDGET_EXCEEDED",
                           reason_detail=f"p95={p95:.1f}ms exceeds {perf_budget_p95_ms}ms budget"[:500],
                           metrics=metrics)

        return Verdict(**base, verdict="pass", reason_code="REPLAY_MATCH",
                       reason_detail=f"{matched}/{len(fixtures)} matched, p95={p95:.1f}ms"[:500],
                       metrics=metrics)
