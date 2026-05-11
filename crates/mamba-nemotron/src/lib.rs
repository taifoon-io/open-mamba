//! Pluggable inference provider client.
//!
//! The bus dispatches `nemotron/<adapter>` tasks through this crate.
//! Adapters are arbitrary string slugs the upstream provider exposes
//! (e.g. `taifoon`, `polymarket`, `algotrada`) — open-mamba does not
//! ship a default endpoint. You bring your own.
//!
//! ## Configuration
//!
//! - `NEMOTRON_BASE_URL` — required. The provider's base URL. Must expose
//!   `<base>/<adapter>/generate` (POST JSON) and `<base>/<adapter>/health`.
//! - `TAIFOON_GRID_KEY` — optional. Taifoon-grid API key (`taif-…`) sent as
//!   `x-taifoon-key`. Use this when the upstream is a taifoon-grid
//!   endpoint. Get a key by registering a wallet at
//!   `<grid>/api/grid/register` (deterministic, derived on-chain from
//!   wallet + chainId).
//! - `NEMOTRON_API_KEY` — optional. Sent as `Authorization: Bearer …`.
//!   Use for non-taifoon providers (vLLM, Ollama, generic OpenAI-compatible).
//!
//! Both auth headers are forwarded if both are set, so a single client
//! can talk to either kind of provider depending on what it expects.
//!
//! ## Cost model (taifoon-grid path)
//!
//! Each `generate` call deducts grid credits per the provider's posted
//! weights (see `GRID_PRICING_PLANS.md` upstream). The grid contract
//! is the source of truth for balance + API-key validity — open-mamba
//! is purely the dispatcher.
//!
//! Response shape (any provider must conform):
//!   { response: string, tokens: u32, duration: f64, tokens_per_second: f64,
//!     model: optional string }

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use tracing::debug;

/// Which adapter to route to. Slug is forwarded verbatim in the URL.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NemotronAdapter {
    Taifoon,
    Polymarket,
    Algotrada,
    /// General-purpose helper. Routes to `<base>/general/generate`.
    /// Requires a valid `x-taifoon-key` (TAIFOON_GRID_KEY). Callers
    /// without a key get a 401 with a buy-on-Base redirect URL.
    General,
}

impl NemotronAdapter {
    pub fn slug(&self) -> &'static str {
        match self {
            Self::Taifoon    => "taifoon",
            Self::Polymarket => "polymarket",
            Self::Algotrada  => "algotrada",
            Self::General    => "general",
        }
    }

    /// Parse from open-mamba model string e.g. "nemotron/general"
    pub fn from_model_str(s: &str) -> Option<Self> {
        let lower = s.to_lowercase();
        if lower.contains("taifoon")    { return Some(Self::Taifoon); }
        if lower.contains("polymarket") { return Some(Self::Polymarket); }
        if lower.contains("algotrada")  { return Some(Self::Algotrada); }
        if lower.contains("general")    { return Some(Self::General); }
        None
    }

    /// Whether this adapter requires a grid key to dispatch.
    pub fn requires_grid_key(&self) -> bool {
        matches!(self, Self::General)
    }
}

#[derive(Debug, Serialize)]
struct GenerateRequest<'a> {
    prompt: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<&'a str>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub response: String,
    pub tokens: u32,
    pub duration: f64,
    pub tokens_per_second: f64,
    pub model: Option<String>,
}

pub struct NemotronClient {
    base_url: Option<String>,
    /// Bearer token for OpenAI-compatible / generic providers.
    api_key: Option<String>,
    /// Taifoon-grid key (`taif-…`), sent as `x-taifoon-key`. Maps to a
    /// registered wallet's prepaid credit balance on the grid contract.
    grid_key: Option<String>,
    http: reqwest::Client,
}

impl NemotronClient {
    /// Construct from env. Returns a client that will refuse to dispatch if
    /// `NEMOTRON_BASE_URL` is unset — open-mamba ships no default endpoint.
    pub fn from_env() -> Self {
        let base_url = std::env::var("NEMOTRON_BASE_URL")
            .ok()
            .filter(|s| !s.is_empty());
        let api_key = std::env::var("NEMOTRON_API_KEY")
            .ok()
            .filter(|s| !s.is_empty());
        let grid_key = std::env::var("TAIFOON_GRID_KEY")
            .ok()
            .filter(|s| !s.is_empty());
        Self {
            base_url,
            api_key,
            grid_key,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap(),
        }
    }

    /// Construct with an explicit base URL. Reads keys from env.
    pub fn with_base(base_url: impl Into<String>) -> Self {
        let base = base_url.into();
        let base = if base.is_empty() { None } else { Some(base) };
        Self {
            base_url: base,
            api_key: std::env::var("NEMOTRON_API_KEY").ok().filter(|s| !s.is_empty()),
            grid_key: std::env::var("TAIFOON_GRID_KEY").ok().filter(|s| !s.is_empty()),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap(),
        }
    }

    pub fn is_configured(&self) -> bool {
        self.base_url.is_some()
    }

    fn require_base(&self) -> Result<&str> {
        self.base_url.as_deref().ok_or_else(|| {
            anyhow::anyhow!(
                "nemotron disabled: set NEMOTRON_BASE_URL to your inference \
                 provider's base URL (and optionally NEMOTRON_API_KEY)"
            )
        })
    }

    pub async fn generate(
        &self,
        adapter: NemotronAdapter,
        prompt: &str,
        system: Option<&str>,
        max_tokens: Option<u32>,
    ) -> Result<GenerateResponse> {
        // General adapter enforces grid key — surfaces a buy-on-Base URL on
        // 401/403 so unauthenticated callers know exactly where to get credits.
        if adapter.requires_grid_key() && self.grid_key.is_none() {
            let buy_url = std::env::var("NEMOTRON_GRID_BUY_URL")
                .unwrap_or_else(|_| "https://scanner.taifoon.dev/grid/buy".into());
            bail!(
                "nemotron/general requires a Taifoon grid key. \
                 Top up on Base and set TAIFOON_GRID_KEY=taif-… in your .env — \
                 get credits at: {buy_url}"
            );
        }
        let base = self.require_base()?;
        // For general adapter: fast-fail if /health returns non-200 so we don't
        // hang the tokio runtime for 120s waiting for a 404/connection-hang.
        // Use a 10s-timeout probe client so the worker slot isn't held for long.
        if matches!(adapter, NemotronAdapter::General) {
            let health_url = format!("{}/general/health", base);
            let mut hreq = self.http.get(&health_url);
            if let Some(ref k) = self.grid_key { hreq = hreq.header("x-taifoon-key", k); }
            // Wrap in tokio timeout so a hanging nginx upstream can't block us
            // indefinitely even if reqwest's own timeout misfires.
            let probe_result = tokio::time::timeout(
                std::time::Duration::from_secs(8),
                hreq.send(),
            ).await;
            match probe_result {
                Err(_elapsed) => bail!(
                    "nemotron/general adapter probe timed out (8s). \
                     Deploy the general adapter on scanner.taifoon.dev."
                ),
                Ok(Ok(r)) if r.status().is_success() => {}
                Ok(Ok(r)) => bail!(
                    "nemotron/general adapter not available (health: {}). \
                     Deploy the general adapter on scanner.taifoon.dev, \
                     or use nemotron/taifoon for domain-specific queries.",
                    r.status()
                ),
                Ok(Err(e)) => bail!(
                    "nemotron/general health check failed ({}). \
                     Adapter not deployed — add it to scanner.taifoon.dev.",
                    e
                ),
            }
        }
        let url = format!("{}/{}/generate", base, adapter.slug());
        // For general adapter, fall back to NEMOTRON_GENERAL_SYSTEM env or a
        // sensible default if no explicit system prompt is provided.
        let general_system_buf;
        let effective_system = if matches!(adapter, NemotronAdapter::General) && system.is_none() {
            general_system_buf = std::env::var("NEMOTRON_GENERAL_SYSTEM")
                .unwrap_or_else(|_| "You are a helpful general-purpose assistant. Be concise and factual.".into());
            Some(general_system_buf.as_str())
        } else {
            system
        };
        let body = GenerateRequest {
            prompt,
            max_tokens,
            temperature: Some(0.3),
            system: effective_system,
        };
        debug!("nemotron {} → {}", adapter.slug(), &prompt[..prompt.len().min(80)]);
        let mut req = self.http.post(&url).json(&body);
        if let Some(ref key) = self.grid_key {
            req = req.header("x-taifoon-key", key);
        }
        if let Some(ref key) = self.api_key {
            req = req.bearer_auth(key);
        }
        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            // 401/403 on general adapter → guide them to buy credits on Base.
            if matches!(adapter, NemotronAdapter::General)
                && (status == 401 || status == 403)
            {
                let buy_url = std::env::var("NEMOTRON_GRID_BUY_URL")
                    .unwrap_or_else(|_| "https://scanner.taifoon.dev/grid/buy".into());
                bail!(
                    "nemotron/general: grid key rejected ({}). \
                     Top up credits on Base: {}",
                    status, buy_url
                );
            }
            bail!("nemotron {} returned {}: {}", adapter.slug(), status, text);
        }
        Ok(resp.json().await?)
    }

    pub async fn health_all(&self) -> Vec<(NemotronAdapter, bool)> {
        let Some(base) = self.base_url.clone() else {
            return vec![
                (NemotronAdapter::Taifoon, false),
                (NemotronAdapter::Polymarket, false),
                (NemotronAdapter::Algotrada, false),
                (NemotronAdapter::General, false),
            ];
        };
        let api_key = self.api_key.clone();
        let grid_key = self.grid_key.clone();
        let check = |adapter: NemotronAdapter| {
            let url = format!("{}/{}/health", base, adapter.slug());
            let http = self.http.clone();
            let api = api_key.clone();
            let grid = grid_key.clone();
            async move {
                let mut req = http.get(&url);
                if let Some(k) = grid {
                    req = req.header("x-taifoon-key", k);
                }
                if let Some(k) = api {
                    req = req.bearer_auth(k);
                }
                let ok = req
                    .send()
                    .await
                    .map(|r| r.status().is_success())
                    .unwrap_or(false);
                (adapter, ok)
            }
        };
        let (t, p, a, g) = tokio::join!(
            check(NemotronAdapter::Taifoon),
            check(NemotronAdapter::Polymarket),
            check(NemotronAdapter::Algotrada),
            check(NemotronAdapter::General),
        );
        vec![t, p, a, g]
    }
}

impl Default for NemotronClient {
    fn default() -> Self { Self::from_env() }
}
