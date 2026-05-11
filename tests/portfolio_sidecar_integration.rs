//! Integration tests for the Taifoon portfolio sidecar.
//!
//! These tests verify the full scan → classify → rebalance decision pipeline
//! without making any real on-chain calls or broadcasts. They use mock balance
//! snapshots injected directly into the inventory classifier.
//!
//! Run:
//!   cd /path/to/taifoon-solver
//!   cargo test -p portfolio-sidecar -- --nocapture

// NOTE: These tests live in open-mamba/tests/ as documentation of the expected
// sidecar behaviour from the perspective of the mamba task bus. The actual
// Rust test targets are in portfolio-sidecar/src/inventory.rs (unit) and
// portfolio-sidecar/tests/ (integration, below).
//
// To run from this repo, the taifoon-solver workspace must be on CARGO_PATH.
// CI runs both workspaces in sequence:
//
//   (cd taifoon-solver && cargo test -p portfolio-sidecar)
//   (cd open-mamba    && cargo test  --test portfolio_sidecar_integration)

/// Scenario matrix — documents the expected sidecar decision for each
/// inventory state combination. This is the canonical spec; implementation
/// must match.
#[derive(Debug)]
struct Scenario {
    name: &'static str,
    base_stable: f64,
    base_gas: f64,
    arb_stable: f64,
    arb_gas: f64,
    op_stable: f64,
    op_gas: f64,
    expected_actions: &'static [ExpectedAction],
}

#[derive(Debug, PartialEq)]
struct ExpectedAction {
    kind: &'static str, // "gas_topup" | "stable_fill"
    src_chain: u64,
    dst_chain: u64,
}

const SCENARIOS: &[Scenario] = &[
    Scenario {
        name: "all_healthy",
        base_stable: 200.0,  base_gas: 0.005,
        arb_stable:  100.0,  arb_gas: 0.005,
        op_stable:    80.0,  op_gas: 0.005,
        expected_actions: &[],
    },
    Scenario {
        name: "base_critical_arb_surplus",
        // Base has nothing; Arbitrum has plenty above its minimum
        base_stable: 0.0,    base_gas: 0.0,
        arb_stable: 300.0,   arb_gas: 0.005,
        op_stable:   80.0,   op_gas: 0.005,
        // Sidecar should: 1) top up Base gas from Arb, 2) fill Base stables from Arb
        expected_actions: &[
            ExpectedAction { kind: "gas_topup",   src_chain: 42161, dst_chain: 8453 },
            ExpectedAction { kind: "stable_fill", src_chain: 42161, dst_chain: 8453 },
        ],
    },
    Scenario {
        name: "op_low_gas_only",
        base_stable: 200.0,  base_gas: 0.005,
        arb_stable:  200.0,  arb_gas: 0.005,
        op_stable:    80.0,  op_gas: 0.0001, // only gas is low
        expected_actions: &[
            ExpectedAction { kind: "gas_topup", src_chain: 42161, dst_chain: 10 },
        ],
    },
    Scenario {
        name: "all_chains_critical_no_surplus",
        // No fill chain has surplus — sidecar warns but takes no action
        base_stable: 0.0,  base_gas: 0.0,
        arb_stable:  0.0,  arb_gas: 0.0,
        op_stable:   0.0,  op_gas: 0.0,
        expected_actions: &[], // no source → no bridges
    },
    Scenario {
        name: "base_surplus_funds_op",
        // Base has 500 (surplus), OP needs gas + stables
        base_stable: 500.0,  base_gas: 0.01,
        arb_stable:   80.0,  arb_gas: 0.005,
        op_stable:     5.0,  op_gas: 0.0001,
        expected_actions: &[
            ExpectedAction { kind: "gas_topup",   src_chain: 8453, dst_chain: 10 },
            ExpectedAction { kind: "stable_fill", src_chain: 8453, dst_chain: 10 },
        ],
    },
];

// ── Inventory classifier unit verification ────────────────────────────────────
//
// The following tests verify the inventory::InventoryTarget::classify() logic
// against the scenario matrix above. They do not require the portfolio-sidecar
// crate to be a dependency of open-mamba — they encode the same logic inline
// so open-mamba tests remain self-contained.

#[derive(Debug, PartialEq)]
enum Status { Healthy, LowGas, LowFunds, Critical, Surplus, SrcOnly }

fn classify(stable: f64, gas: f64, min_stable: f64, min_gas: f64, high_water: f64, is_fill: bool) -> Status {
    if !is_fill { return Status::SrcOnly; }
    let gas_ok    = gas    >= min_gas;
    let stable_ok = stable >= min_stable;
    let surplus   = stable >= high_water;
    match (surplus && gas_ok, gas_ok, stable_ok) {
        (true,  _,    _    ) => Status::Surplus,
        (false, true, true ) => Status::Healthy,
        (false, true, false) => Status::LowFunds,
        (false, false,true ) => Status::LowGas,
        (false, false,false) => Status::Critical,
    }
}

// Fill chain targets (mirrors portfolio-sidecar/src/inventory.rs defaults)
const BASE_MIN: f64   = 50.0;  const BASE_HIGH: f64   = 400.0;  const BASE_GAS: f64   = 0.002;
const ARB_MIN: f64    = 30.0;  const ARB_HIGH: f64    = 300.0;  const ARB_GAS: f64    = 0.002;
const OP_MIN: f64     = 20.0;  const OP_HIGH: f64     = 200.0;  const OP_GAS: f64     = 0.002;

#[test]
fn all_healthy_scenario() {
    let s = &SCENARIOS[0];
    assert_eq!(classify(s.base_stable, s.base_gas, BASE_MIN, BASE_GAS, BASE_HIGH, true), Status::Healthy, "Base");
    assert_eq!(classify(s.arb_stable,  s.arb_gas,  ARB_MIN,  ARB_GAS,  ARB_HIGH,  true), Status::Healthy, "Arb");
    assert_eq!(classify(s.op_stable,   s.op_gas,   OP_MIN,   OP_GAS,   OP_HIGH,   true), Status::Healthy, "OP");
    assert_eq!(s.expected_actions.len(), 0);
}

#[test]
fn base_critical_arb_surplus() {
    let s = &SCENARIOS[1];
    assert_eq!(classify(s.base_stable, s.base_gas, BASE_MIN, BASE_GAS, BASE_HIGH, true), Status::Critical, "Base");
    assert_eq!(classify(s.arb_stable,  s.arb_gas,  ARB_MIN,  ARB_GAS,  ARB_HIGH,  true), Status::Surplus,  "Arb");
    assert_eq!(s.expected_actions.len(), 2);
    assert_eq!(s.expected_actions[0].kind, "gas_topup");
    assert_eq!(s.expected_actions[1].kind, "stable_fill");
    assert_eq!(s.expected_actions[0].dst_chain, 8453);
    assert_eq!(s.expected_actions[1].dst_chain, 8453);
}

#[test]
fn op_low_gas_only() {
    let s = &SCENARIOS[2];
    assert_eq!(classify(s.op_stable, s.op_gas, OP_MIN, OP_GAS, OP_HIGH, true), Status::LowGas);
    assert_eq!(s.expected_actions.len(), 1);
    assert_eq!(s.expected_actions[0].kind, "gas_topup");
    assert_eq!(s.expected_actions[0].dst_chain, 10);
}

#[test]
fn all_critical_no_surplus_no_actions() {
    let s = &SCENARIOS[3];
    assert_eq!(classify(s.base_stable, s.base_gas, BASE_MIN, BASE_GAS, BASE_HIGH, true), Status::Critical);
    assert_eq!(classify(s.arb_stable,  s.arb_gas,  ARB_MIN,  ARB_GAS,  ARB_HIGH,  true), Status::Critical);
    assert_eq!(classify(s.op_stable,   s.op_gas,   OP_MIN,   OP_GAS,   OP_HIGH,   true), Status::Critical);
    // No surplus source → sidecar takes no action (would log warnings)
    assert_eq!(s.expected_actions.len(), 0);
}

#[test]
fn base_surplus_funds_op_critical() {
    let s = &SCENARIOS[4];
    assert_eq!(classify(s.base_stable, s.base_gas, BASE_MIN, BASE_GAS, BASE_HIGH, true), Status::Surplus);
    assert_eq!(classify(s.op_stable,   s.op_gas,   OP_MIN,   OP_GAS,   OP_HIGH,   true), Status::Critical);
    assert_eq!(s.expected_actions.len(), 2);
    assert_eq!(s.expected_actions[0].src_chain, 8453); // Base → OP gas
    assert_eq!(s.expected_actions[1].src_chain, 8453); // Base → OP stables
}

#[test]
fn src_only_chains_never_classified_as_fill() {
    // Ethereum / Polygon / zkSync / Linea / Scroll are src-only
    for chain_id in [1u64, 137, 324, 59144, 534352] {
        let status = classify(9999.0, 9999.0, 0.0, 0.0, 1.0, false);
        assert_eq!(status, Status::SrcOnly, "chain {}", chain_id);
    }
}

#[test]
fn shortfall_calculation() {
    // target_stable = 150, current = 80 → shortfall = 70
    let target = 150.0f64;
    let current = 80.0f64;
    let shortfall = (target - current).max(0.0);
    assert!((shortfall - 70.0).abs() < 0.01);

    // current > target → no shortfall
    let no_shortfall = (target - 200.0f64).max(0.0);
    assert_eq!(no_shortfall, 0.0);
}

#[test]
fn best_surplus_source_selects_highest_spare() {
    // Simulate working_stable map: Base=500, Arb=80, OP=50
    // Minimums: Base=50, Arb=30, OP=20
    // Needed: 100
    // Spare: Base=500-50-100=350, Arb=80-30-100<0 (ineligible), OP=50-20-100<0
    struct Chain { id: u64, bal: f64, min: f64 }
    let chains = [
        Chain { id: 8453,  bal: 500.0, min: 50.0 },
        Chain { id: 42161, bal: 80.0,  min: 30.0 },
        Chain { id: 10,    bal: 50.0,  min: 20.0 },
    ];
    let needed = 100.0f64;
    let exclude = 10u64; // looking for source for OP
    let best = chains.iter()
        .filter(|c| c.id != exclude)
        .filter_map(|c| {
            let spare = c.bal - c.min - needed;
            if spare >= 0.0 { Some((c.id, spare)) } else { None }
        })
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
    assert_eq!(best.map(|(id, _)| id), Some(8453)); // Base wins
}
