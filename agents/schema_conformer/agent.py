"""
schema-conformer reviewer
=========================

Validates that a contributor's adapter produces output conforming to
fill_event_v1 (or sibling schemas: solver_dossier_v1, etc).

Runs as the second reviewer on every bounty per reviewers.xml <defaults>.

Bootstrap implementation: validates against a static JSON Schema. Production
version additionally:
  - Validates USD value reconciliation against on-chain price oracle within ±25 bps
  - Validates request_ts < fill_ts
  - Validates chain_id integers match canonical registry
  - Validates solver_addr lowercased + checksummed (EVM) or base58 (sol)
"""
from __future__ import annotations

import json
import tarfile
import tempfile
import time
from importlib import util as importlib_util
from pathlib import Path

try:
    from ..orchestrator import Verdict, submission_hash  # type: ignore
except Exception:
    from open_mamba_orchestrator import Verdict, submission_hash  # type: ignore

REVIEWER_ID      = "schema-conformer"
REVIEWER_VERSION = "0.1.0"

THIS_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = THIS_DIR.parent.parent / "verdict_schemas" / "fill_event_v1.json"


def _load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text())


def _validate(obj: dict, schema: dict) -> tuple[bool, str]:
    """Minimal validator. Production uses jsonschema; bootstrap is dependency-free."""
    if obj.get("schema_version") != schema["properties"]["schema_version"].get("const"):
        return False, "schema_version mismatch"
    for k in schema.get("required", []):
        if k not in obj:
            return False, f"required field '{k}' missing"
    # Time ordering
    if "request_ts" in obj and "fill_ts" in obj:
        if obj["request_ts"] > obj["fill_ts"]:
            return False, "request_ts > fill_ts"
    # Amount sanity
    if "amount_usd" in obj and obj["amount_usd"] < 0:
        return False, "amount_usd negative"
    return True, ""


def _load_decoder(extracted_dir: Path):
    decoder_path = extracted_dir / "decoder.py"
    if not decoder_path.exists():
        raise ImportError("decoder.py missing")
    spec = importlib_util.spec_from_file_location("contrib_decoder", decoder_path)
    mod = importlib_util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return mod


def review(submission_path: Path, bounty: dict, meta: dict) -> Verdict:
    sub_hash = submission_hash(submission_path)
    base = dict(
        schema_version     = "reviewer_verdict_v1",
        reviewer_id        = REVIEWER_ID,
        reviewer_version   = REVIEWER_VERSION,
        bounty_id          = bounty["id"],
        submission_hash    = sub_hash,
        contributor_wallet = bounty["contributor"],
        replay_block_set   = "schema-only",
        signed_at          = int(time.time()),
        signature          = "0x00",
    )

    schema = _load_schema()

    # Smoke-test: decode a sample input through the contributor's decoder, then
    # validate the output against fill_event_v1.
    with tempfile.TemporaryDirectory() as td:
        try:
            with tarfile.open(submission_path, "r:gz") as t:
                t.extractall(td)
        except Exception as e:
            return Verdict(**base, verdict="fail", reason_code="SCHEMA_INVALID",
                           reason_detail=f"tarball: {e}"[:500])

        # Look for a manifest indicating the schema the adapter produces
        manifest_path = Path(td) / "manifest.json"
        if not manifest_path.exists():
            return Verdict(**base, verdict="fail", reason_code="LICENSE_MISSING",
                           reason_detail="manifest.json missing (must declare emits + license)")
        try:
            manifest = json.loads(manifest_path.read_text())
        except Exception as e:
            return Verdict(**base, verdict="fail", reason_code="SCHEMA_INVALID",
                           reason_detail=f"manifest.json invalid: {e}"[:500])

        if "license" not in manifest or "emits" not in manifest:
            return Verdict(**base, verdict="fail", reason_code="LICENSE_MISSING",
                           reason_detail="manifest.json must declare 'license' and 'emits'")

        # Validate sample output
        try:
            decoder = _load_decoder(Path(td))
        except Exception as e:
            return Verdict(**base, verdict="fail", reason_code="SCHEMA_INVALID",
                           reason_detail=f"decoder.py: {e}"[:500])

        sample_input = manifest.get("sample_input", {})
        try:
            sample_output = decoder.decode_event(sample_input)
        except Exception as e:
            return Verdict(**base, verdict="fail", reason_code="SCHEMA_INVALID",
                           reason_detail=f"sample decode threw: {e}"[:500])

        ok, why = _validate(sample_output, schema)
        if not ok:
            return Verdict(**base, verdict="fail", reason_code="SCHEMA_INVALID",
                           reason_detail=why)

        return Verdict(**base, verdict="pass", reason_code="SCHEMA_CONFORMS",
                       reason_detail="manifest valid, sample decode conforms to fill_event_v1")
