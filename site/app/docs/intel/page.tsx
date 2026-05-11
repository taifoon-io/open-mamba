import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata = { title: "taifoon-intel API — open-mamba docs" };

// Live-verified 2026-04-28. All 3 adapters confirmed loaded.
const ADAPTERS = [
  {
    slug: "taifoon",
    color: "text-brand",
    path: "/root/taifoon-nemotron/adapters/final",
    desc: "Protocol intel — V5 finality, solver economics, cross-chain Q&A.",
    status: "live",
  },
  {
    slug: "polymarket",
    color: "text-accent",
    path: "/root/nemotron_training/models/polymarket-v2/final",
    desc: "15-min crypto price predictions, market sentiment classification.",
    status: "live",
  },
  {
    slug: "algotrada",
    color: "text-info",
    path: "/root/algotrada-training/adapters/final-v2",
    desc: "AlgoTrada trading decisions — SMT divergence, Goldbach confluence, P3 zones.",
    status: "live",
  },
];

export default function Page() {
  return (
    <>
      <Nav />
      <main className="container-tight py-20">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="max-w-3xl">
          <div className="bracketed mb-4">INFERENCE · taifoon-intel API</div>
          <h1 className="text-display-lg text-text">
            Three adapters.{" "}
            <span className="text-brand">One endpoint shape.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-text/65">
            NVIDIA Nemotron-3-Nano-4B-BF16 (Mamba/Transformer hybrid) served on
            one RTX 4000 Ada GPU at{" "}
            <code className="font-mono text-[13px] text-text bg-surface/60 px-1.5 py-0.5">
              scanner.taifoon.dev
            </code>
            . Three QLoRA adapters share the base model — sub-millisecond
            adapter switching, no second process, no OOM.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://scanner.taifoon.dev/api/intel/_meta"
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              LIVE_META ↗
            </a>
            <a
              href="https://github.com/yawningmonsoon/taifoon-intel-platform"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              PLATFORM_REPO ↗
            </a>
          </div>
        </div>

        {/* ── Adapter status ─────────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl">
          <div className="bracketed mb-4">ADAPTERS · ALL LIVE</div>
          <div className="divide-y divide-text/[0.06] border border-text/[0.06]">
            {ADAPTERS.map((a) => (
              <div key={a.slug} className="flex items-start gap-5 bg-surface/20 px-5 py-4">
                <code className={`w-28 shrink-0 font-mono text-[13px] font-bold ${a.color}`}>
                  {a.slug}
                </code>
                <div className="flex-1">
                  <p className="text-[13px] text-text/70 leading-relaxed">{a.desc}</p>
                  <p className="mt-1 font-mono text-[11px] text-text/35">{a.path}</p>
                </div>
                <span className="mt-0.5 shrink-0 font-mono text-[11px] text-green-400">● {a.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Discovery ──────────────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-5">
          <div className="bracketed mb-1">DISCOVERY</div>
          <p className="text-[13px] text-text/65">
            Hit{" "}
            <code className="font-mono text-[13px] text-text bg-surface/60 px-1.5 py-0.5">
              /api/intel/_meta
            </code>{" "}
            once at agent startup. Cache the response for the session — never
            hardcode the model list.
          </p>
          <CodeBlock filename="discovery.sh">{`curl -s https://scanner.taifoon.dev/api/intel/_meta
# {
#   "models":      ["taifoon","polymarket","algotrada"],
#   "base_model":  "nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16",
#   "precision":   "bf16",
#   "version":     "1.0.0",
#   "platform_repo": "https://github.com/yawningmonsoon/taifoon-intel-platform"
# }`}</CodeBlock>
        </div>

        {/* ── Health ─────────────────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-5">
          <div className="bracketed mb-1">HEALTH CHECK</div>
          <p className="text-[13px] text-text/65">
            Check before your first generate. Returns{" "}
            <code className="font-mono text-[13px] text-text bg-surface/60 px-1.5 py-0.5">200</code>{" "}
            if the adapter is loaded,{" "}
            <code className="font-mono text-[13px] text-text bg-surface/60 px-1.5 py-0.5">503</code>{" "}
            if the slot is reserved but adapter not yet trained.
          </p>
          <CodeBlock filename="health.sh">{`# One adapter
curl -s https://scanner.taifoon.dev/api/intel/algotrada/health
# → {"loaded":true,"name":"algotrada","path":"/root/algotrada-training/adapters/final-v2"}

# Overall — all adapters + GPU stats
curl -s https://scanner.taifoon.dev/health`}</CodeBlock>
        </div>

        {/* ── Generate ───────────────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-5">
          <div className="bracketed mb-1">GENERATE · POST /api/intel/&lt;model&gt;/generate</div>

          <div className="grid gap-px bg-text/[0.06] md:grid-cols-2 border border-text/[0.06]">
            <div className="bg-bg p-5">
              <div className="font-mono text-[11px] tracking-[0.12em] text-text/40 mb-3">REQUEST FIELDS</div>
              <table className="w-full text-[12px] font-mono">
                <tbody className="divide-y divide-text/[0.04]">
                  {[
                    ["prompt",      "string",  "required"],
                    ["max_tokens",  "u32",     "default 128"],
                    ["temperature", "f32",     "default 0.6"],
                    ["system",      "string?", "override persona"],
                  ].map(([f, t, note]) => (
                    <tr key={f} className="leading-loose">
                      <td className="pr-4 text-brand/80">{f}</td>
                      <td className="pr-4 text-text/50">{t}</td>
                      <td className="text-text/35">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-bg p-5">
              <div className="font-mono text-[11px] tracking-[0.12em] text-text/40 mb-3">RESPONSE FIELDS</div>
              <table className="w-full text-[12px] font-mono">
                <tbody className="divide-y divide-text/[0.04]">
                  {[
                    ["model",             "string", "adapter slug"],
                    ["response",          "string", "generated text"],
                    ["tokens",            "u32",    "output token count"],
                    ["duration",          "f64",    "seconds wall-time"],
                    ["tokens_per_second", "f64",    "throughput"],
                  ].map(([f, t, note]) => (
                    <tr key={f} className="leading-loose">
                      <td className="pr-4 text-brand/80">{f}</td>
                      <td className="pr-4 text-text/50">{t}</td>
                      <td className="text-text/35">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <CodeBlock filename="generate.sh">{`# curl
curl -sS -X POST https://scanner.taifoon.dev/api/intel/taifoon/generate \\
  -H 'Content-Type: application/json' \\
  -d '{"prompt":"Which bridge is fastest for Arb→Base USDC?","max_tokens":120}'

# Response
# { "model":"taifoon", "response":"...", "tokens":96,
#   "duration":2.97, "tokens_per_second":0.74 }`}</CodeBlock>

          <CodeBlock filename="generate.py">{`# Python — drop-in client (stdlib only)
# Get taifoon_intel.py from:
#   github.com/yawningmonsoon/taifoon-intel-platform/blob/main/clients/python/taifoon_intel.py

from taifoon_intel import TaifoonIntel
intel = TaifoonIntel()                 # base_url="https://scanner.taifoon.dev"

# discover
print(intel.list_models())             # ['taifoon', 'polymarket', 'algotrada']

# health before first call
intel.health('algotrada')              # {"loaded": True, ...}

# generate
out = intel.generate(
    'algotrada',
    'BTC at 94000, SMT bullish 90m, P3 zone FDL. Trading decision?',
    max_tokens=200,
    temperature=0.3,
)
print(out['response'])
print(out['tokens_per_second'], 'tok/s')`}</CodeBlock>

          <CodeBlock filename="generate.rs">{`// Rust — via mamba-nemotron crate (from open-mamba)
use mamba_nemotron::{NemotronAdapter, NemotronClient};

// Env: NEMOTRON_BASE_URL=https://scanner.taifoon.dev/api/intel
let client = NemotronClient::from_env();

let resp = client
    .generate(NemotronAdapter::Algotrada, "Your prompt", None, Some(200))
    .await?;

println!("{}", resp.response);
println!("{:.1} tok/s", resp.tokens_per_second);`}</CodeBlock>
        </div>

        {/* ── open-mamba task routing ─────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-5">
          <div className="bracketed mb-1">OPEN-MAMBA BUS · ROUTING TASKS TO NEMOTRON</div>
          <p className="text-[13px] text-text/65">
            Set{" "}
            <code className="font-mono text-[13px] text-text bg-surface/60 px-1.5 py-0.5">
              NEMOTRON_BASE_URL=https://scanner.taifoon.dev/api/intel
            </code>{" "}
            in your{" "}
            <code className="font-mono text-[13px] text-text bg-surface/60 px-1.5 py-0.5">
              .env
            </code>
            . Then ingest tasks with{" "}
            <code className="font-mono text-[13px] text-text bg-surface/60 px-1.5 py-0.5">
              model: "nemotron/&lt;adapter&gt;"
            </code>
            .
          </p>
          <CodeBlock filename=".env">{`# open-mamba .env
NEMOTRON_BASE_URL=https://scanner.taifoon.dev/api/intel

# Optional: gate nemotron tasks behind a grid key
TAIFOON_GRID_KEY=taif-…`}</CodeBlock>

          <CodeBlock filename="ingest-task.sh">{`# Route a task to algotrada via the bus
curl -X POST http://localhost:1337/ingest \\
  -H 'Content-Type: application/json' \\
  -d '{
    "project":        "algotrada-brain",
    "assigned_agent": "algo-trader",
    "model":          "nemotron/algotrada",
    "payload":        "BTC at 94000, SMT bullish 90m, P3 FDL. Decision?",
    "priority":       3
  }'

# Direct generate (no bus — spends budget immediately)
curl -X POST http://localhost:1337/api/nemotron/algotrada/generate \\
  -H 'x-mamba-key: <MAMBA_API_KEY>' \\
  -H 'Content-Type: application/json' \\
  -d '{"prompt":"BTC decision?","max_tokens":120}'`}</CodeBlock>
        </div>

        {/* ── Auth ───────────────────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-5">
          <div className="bracketed mb-1">AUTH</div>
          <div className="divide-y divide-text/[0.06] border border-text/[0.06]">
            {[
              {
                header: "x-taifoon-key: taif-…",
                via: "TAIFOON_GRID_KEY",
                when: "When calling scanner.taifoon.dev directly and you have a grid API key (registered wallet).",
              },
              {
                header: "Authorization: Bearer …",
                via: "NEMOTRON_API_KEY",
                when: "Open-mamba bus → your own vLLM / Ollama / TGI host.",
              },
              {
                header: "(none)",
                via: "—",
                when: "scanner.taifoon.dev is open today for owner-internal use. No key needed from the algotrada-brain network.",
              },
            ].map((r) => (
              <div key={r.header} className="bg-bg px-5 py-4 text-[13px]">
                <code className="font-mono text-brand/90">{r.header}</code>
                <span className="ml-3 font-mono text-[11px] text-text/35">env: {r.via}</span>
                <p className="mt-1 text-text/55">{r.when}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Corpus / data lake ─────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-5">
          <div className="bracketed mb-1">DATA LAKE · FEEDING THE MODEL</div>
          <p className="text-[13px] text-text/65">
            Append operational intel during the week. The Sunday 03:00 cron picks
            it up and retrains. Format: OpenAI chat JSONL.
          </p>
          <CodeBlock filename="append-ops-shard.py">{`import json, time

record = {
  "messages": [
    {"role": "system",    "content": "You are AlgoTrada Brain, a price-action decision engine."},
    {"role": "user",      "content": "BTC at 94000, SMT bullish 90m, P3 FDL, Goldbach OB_LO."},
    {"role": "assistant", "content": '{"action":"LONG","confidence":0.82,"size":0.05,'
                                     '"entry":94000,"sl":92200,"tp":97000,'
                                     '"reasoning":"SMT+Goldbach confluence in discount zone"}'},
  ]
}
date = time.strftime('%Y-%m-%d')
shard = f'/root/taifoon-intel-data/algotrada/shards/v3_ops_{date}.jsonl'
with open(shard, 'a') as f:
    f.write(json.dumps(record) + '\\n')
# Also add shard name to manifest.json active_shards if not present`}</CodeBlock>

          <CodeBlock filename="manifest.json">{`{
  "model": "algotrada",
  "active_shards": [
    "v1_canonical.jsonl",
    "v3_ops_2026-04-28.jsonl"
  ],
  "base_model": "nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16",
  "lora_config": {"r":32,"alpha":64,"dropout":0.05,
    "target_modules":["q_proj","k_proj","v_proj","o_proj",
                      "up_proj","down_proj","gate_proj"]},
  "epochs": 3,
  "owner": "yawningmonsoon",
  "last_updated": "2026-04-28"
}`}</CodeBlock>
        </div>

        {/* ── Errors ─────────────────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-5">
          <div className="bracketed mb-1">ERRORS</div>
          <div className="divide-y divide-text/[0.06] border border-text/[0.06]">
            {[
              { code: "404", body: '{"error":"unknown_model","available":[...]}', reason: "Wrong adapter slug." },
              { code: "400", body: '{"error":"prompt required"}',               reason: "Empty or missing prompt field." },
              { code: "503", body: '{"error":"adapter_not_loaded",...}',        reason: "Slot reserved, adapter not yet trained." },
              { code: "401", body: '{"error":"nemotron routing requires..."}',  reason: "TAIFOON_GRID_KEY set but x-grid-key header missing/invalid." },
            ].map((e) => (
              <div key={e.code} className="flex items-start gap-4 bg-bg px-5 py-4">
                <code className="w-10 shrink-0 font-mono text-[13px] font-bold text-text/50">{e.code}</code>
                <code className="flex-1 font-mono text-[12px] text-text/70 break-all">{e.body}</code>
                <p className="w-52 shrink-0 text-[12px] text-text/45">{e.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Latency expectations ───────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-4">
          <div className="bracketed mb-1">LATENCY</div>
          <ul className="space-y-2 text-[13px] text-text/65">
            <li>• Steady-state: <strong className="text-text">~0.74 tok/s</strong> — all 3 adapters share the same base weights and GPU.</li>
            <li>• First request after restart pays a ~30s CUDA warm-up. The systemd unit pre-warms at boot so users normally don't see this.</li>
            <li>• Use <code className="font-mono text-text bg-surface/60 px-1 py-0.5">--max-time 30</code> for <code className="font-mono">max_tokens ≤ 256</code>. Use <code className="font-mono text-text bg-surface/60 px-1 py-0.5">--max-time 60</code> for longer outputs.</li>
            <li>• No rate limits enforced today. Sustained &gt;1 RPS: batch requests or coordinate with the owner.</li>
          </ul>
        </div>

        {/* ── Do NOT rules ───────────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl space-y-4">
          <div className="bracketed mb-1">CONVENTIONS · DO NOT BREAK</div>
          <ul className="space-y-2 text-[13px] text-text/65">
            <li>❌ <code className="font-mono text-text bg-surface/60 px-1 py-0.5">AutoModelForCausalLM.from_pretrained('nvidia/...')</code> from agent code. Use the HTTP API.</li>
            <li>❌ <code className="font-mono text-text bg-surface/60 px-1 py-0.5">pip install -U torch</code> or <code className="font-mono text-text bg-surface/60 px-1 py-0.5">pip install -U mamba-ssm</code> on the GPU server — breaks the ABI shim.</li>
            <li>❌ Start a second Python inference process. One base model, one port.</li>
            <li>❌ Qwen, Llama, Mistral. Base model is <strong className="text-text">Nemotron-3-Nano-4B-BF16</strong>. Always.</li>
            <li>✅ <code className="font-mono text-text bg-surface/60 px-1 py-0.5">LD_PRELOAD=/root/taifoon-training/libtorch_shim.so</code> on every training process.</li>
            <li>✅ Stop <code className="font-mono text-text bg-surface/60 px-1 py-0.5">taifoon-intel-api.service</code> before training. Restart after.</li>
            <li>✅ New adapter? Follow <code className="font-mono text-text bg-surface/60 px-1 py-0.5">docs/adding-an-adapter.md</code> in the platform repo.</li>
          </ul>
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <a href="https://github.com/yawningmonsoon/taifoon-intel-platform" target="_blank" rel="noreferrer" className="btn-primary">
            PLATFORM_REPO ↗
          </a>
          <Link href="/docs" className="btn-ghost">BACK_TO_DOCS</Link>
        </div>

      </main>
      <Footer />
    </>
  );
}
