import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CodeBlock } from "@/components/CodeBlock";
import { WorkflowBlock } from "@/components/WorkflowBlock";
import { MambaMark } from "@/components/Logo";

export default function Home() {
  return (
    <>
      <Nav />

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 top-[-15%] h-[55vh] vignette pointer-events-none" />
        <div aria-hidden className="absolute inset-0 coord-grid coord-grid-fade pointer-events-none opacity-70" />
        <div className="container-tight relative pt-24 pb-20 md:pt-28">
          <div className="mx-auto max-w-3xl text-center page-enter">
            <Link
              href="https://github.com/yawningmonsoon/open-mamba"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-text/[0.1] bg-surface/40 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-text/70 hover:text-brand hover:border-brand/40 transition-colors"
            >
              <span className="badge-brand">v0.1</span>
              <span>NOW WITH NEMOTRON ROUTING</span>
              <span aria-hidden>↗</span>
            </Link>

            <div className="mt-7 flex justify-center">
              <MambaMark size={88} className="animate-fade-in" />
            </div>

            <h1 className="mt-7 text-display-xl text-text">
              An autonomous task bus
              <br />
              <span className="text-brand">for AI agents.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-text/65">
              Drop work into a queue. The mamba dispatches it to Claude or your
              own Nemotron host, anchors the receipt, and recycles. No accounts,
              no telemetry, no vendor lock-in. <span className="text-text">Free. MIT. Self-hosted.</span>
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/yawningmonsoon/open-mamba#install"
                target="_blank"
                rel="noreferrer"
                className="btn-primary px-5"
              >
                $ GIT_CLONE_&&_CARGO_BUILD
              </a>
              <Link href="/docs" className="btn-ghost px-5">
                READ_THE_DOCS
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] tracking-[0.16em] text-text/45">
              <span className="inline-flex items-center gap-1.5">
                <span className="live-dot" />
                MIT_LICENSED
              </span>
              <span>·</span>
              <span>SELF_HOSTED_IN_60s</span>
              <span>·</span>
              <span>NO_API_KEYS_TO_JUGGLE</span>
              <span>·</span>
              <span>NO_TELEMETRY</span>
            </div>
          </div>

          {/* Hero install demo */}
          <div className="mx-auto mt-14 max-w-3xl" id="install">
            <CodeBlock filename="install.sh">{`# 1. Build from source — Rust toolchain required
git clone https://github.com/yawningmonsoon/open-mamba.git
cd open-mamba
cargo build --release --bin open-mamba

# 2. Symlink the wrapper, then boot the bus on :1337
sudo ln -sf "$PWD/scripts/mamba" /usr/local/bin/mamba
mamba up

# 3. Drop a task in
curl -X POST http://localhost:1337/ingest \\
  -H 'content-type: application/json' \\
  -d '{
    "project": "demo",
    "agent":   "code-reviewer",
    "model":   "nemotron/taifoon",
    "payload": "Review the open PRs on yawningmonsoon/spinner"
  }'
# → { "id": "7a2f9c4d…" }

# 4. Watch the burn
open http://localhost:1337   # the local console

# brew tap + curl-pipe-sh installers — coming with v0.1.0 release.
`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* ─── WHAT IT DOES ─── */}
      <section id="what-it-does" className="container-tight py-24">
        <div className="mb-12 max-w-2xl">
          <div className="bracketed mb-4">WHAT IT DOES</div>
          <h2 className="text-display-md text-text">
            Like cron, but for AI work. <span className="text-brand">And less crusty.</span>
          </h2>
          <p className="mt-4 text-text/65 leading-relaxed">
            Three jobs: hold the queue, dispatch the work, log what it cost.
            That's it. No DSL. No SaaS account. No "free tier" with an asterisk.
          </p>
        </div>

        <div className="grid gap-px bg-text/[0.06] md:grid-cols-3 border border-text/[0.06]">
          {WHAT.map((w) => (
            <div key={w.title} className="bg-bg p-7">
              <div className="font-mono text-[11px] tracking-[0.2em] text-brand">{w.tag}</div>
              <h3 className="mt-4 font-mono text-[15px] font-bold tracking-[0.1em] uppercase text-text">{w.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-text/65">{w.body}</p>
              <div className="mt-5 font-mono text-[11px] tracking-[0.14em] text-text/45 border-t border-text/[0.06] pt-3">
                {w.signal}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── DATAFLOW DIAGRAM ─── */}
      <section className="border-y border-text/[0.06] bg-surface/30">
        <div className="container-tight py-20">
          <div className="mb-10 max-w-2xl">
            <div className="bracketed mb-4">THE DATAFLOW</div>
            <h2 className="text-display-md text-text">
              Five boxes. <span className="text-brand">One arrow goes back.</span>
            </h2>
            <p className="mt-3 text-sm text-text/60">
              Tasks come in via webhook, cron, or curl. The worker pulls one,
              dispatches it, writes the receipt back to the lake. Repeat.
            </p>
          </div>
          <div className="border border-text/[0.06] bg-bg/60 p-6 md:p-10">
            <WorkflowBlock />
          </div>
        </div>
      </section>

      {/* ─── EXAMPLES ─── */}
      <section id="examples" className="container-tight py-24">
        <div className="mb-12 max-w-2xl">
          <div className="bracketed mb-4">EXAMPLES</div>
          <h2 className="text-display-md text-text">
            Real workflows. <span className="text-brand">Copy-paste ready.</span>
          </h2>
          <p className="mt-3 text-sm text-text/60">
            Three things people actually do with the mamba. No "Hello, World"
            here — these run.
          </p>
        </div>

        <div className="space-y-8">
          {EXAMPLES.map((ex) => (
            <div key={ex.title} className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
              <div>
                <div className="font-mono text-[11px] tracking-[0.18em] text-brand">{ex.tag}</div>
                <h3 className="mt-3 font-mono text-[16px] font-bold tracking-[0.1em] uppercase text-text">{ex.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-text/65">{ex.body}</p>
              </div>
              <CodeBlock filename={ex.filename}>{ex.code}</CodeBlock>
            </div>
          ))}
        </div>
      </section>

      {/* ─── WHY (playful FAQ) ─── */}
      <section className="border-t border-text/[0.06] bg-surface/30">
        <div className="container-tight py-20">
          <div className="mb-10 max-w-2xl">
            <div className="bracketed mb-4">WHY</div>
            <h2 className="text-display-md text-text">
              Yes, but <span className="text-brand">why?</span>
            </h2>
          </div>
          <div className="grid gap-px bg-text/[0.06] md:grid-cols-2 border border-text/[0.06]">
            {WHY.map((q) => (
              <div key={q.q} className="bg-bg p-7">
                <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-text">
                  <span className="text-brand">Q.</span> {q.q}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-text/70">
                  <span className="font-mono text-[12px] tracking-[0.14em] text-accent">A. </span>
                  {q.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAMILY CALLOUT ─── */}
      <section className="container-tight py-24">
        <div className="border border-text/[0.08] bg-surface/30 p-8 md:p-10 grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="flex items-center gap-3">
            <span className="badge-family">PART OF</span>
            <span className="font-mono text-[12px] tracking-[0.18em] text-family">TAIFOON FAMILY</span>
          </div>
          <p className="text-sm leading-relaxed text-text/70">
            Need multi-tenant, SSO, audit, and a cost-optimizer that picks the
            cheapest model meeting your quality bar? Same Rust engine, paid
            commercial layer on top.
          </p>
          <div className="flex gap-3">
            <a
              href="https://taifoon.io/products/taifoon-mamba"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              SEE_TAIFOON_PRO ↗
            </a>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="container-tight pb-32">
        <div className="relative border border-text/[0.08] bg-surface/30 p-12 md:p-16 text-center overflow-hidden">
          <div aria-hidden className="absolute inset-0 vignette" />
          <div className="relative">
            <MambaMark size={56} className="mx-auto" />
            <h2 className="mt-6 text-display-md text-text">
              60 seconds. <span className="text-brand">No card.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-text/65">
              Install it. If it doesn't earn its keep in a week, uninstall it.
              Your DuckDB stays on your machine either way.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/yawningmonsoon/open-mamba#install"
                target="_blank"
                rel="noreferrer"
                className="btn-primary px-5"
              >
                $ GIT_CLONE_&&_CARGO_BUILD
              </a>
              <a
                href="https://github.com/yawningmonsoon/open-mamba"
                target="_blank"
                rel="noreferrer"
                className="btn-ghost px-5"
              >
                ★ STAR_ON_GITHUB
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

const WHAT = [
  {
    tag:    "01 · QUEUE",
    title:  "Holds the work",
    body:   "Every task lands in DuckDB before anything fires. Survive crashes, restarts, replays. The lake is yours, on your disk, queryable with plain SQL.",
    signal: "DUCKDB · DURABLE · YOURS",
  },
  {
    tag:    "02 · DISPATCH",
    title:  "Routes to a runtime",
    body:   "Routine work goes to Nemotron adapters at near-zero cost. Hard work goes to Claude via the local CLI. Bring your own host — vLLM, Ollama, anything OpenAI-compatible.",
    signal: "BYO_INFERENCE · NO_KEYS",
  },
  {
    tag:    "03 · OBSERVE",
    title:  "Tells you what it cost",
    body:   "Live console at :1337. Tokens in, tokens out, dollars spent, by project, agent, model. No telemetry leaves your machine. The dashboard is the binary.",
    signal: "LOCALHOST · NO_PHONE_HOME",
  },
];

const EXAMPLES = [
  {
    tag:      "EXAMPLE 01",
    title:    "Summarize every PR",
    body:     "Wire a GitHub webhook. Each PR triggers a Claude review. The result lands in a Slack thread you control — using your own bot token, not ours.",
    filename: "github-pr.sh",
    code: `# Register the webhook once
curl -X POST :1337/api/webhooks -d '{
  "hook_id":          "github-pr-summary",
  "project":          "demo",
  "assigned_agent":   "code-reviewer",
  "model":            "claude-sonnet-4-6",
  "payload_template": "Summarize this PR in three bullets."
}'

# GitHub fires it on every pull_request event
# → POST /webhooks/github-pr-summary  → task queued → review posted to slack`,
  },
  {
    tag:      "EXAMPLE 02",
    title:    "Cheap signals on a cron",
    body:     "Every 15 minutes, ask the polymarket adapter for a 15-min crypto prediction. Costs basically nothing because Nemotron runs on free GPU.",
    filename: "schedule.sh",
    code: `# Schedule it
curl -X POST :1337/api/schedules -d '{
  "schedule_id":    "polymarket-15m",
  "cron":           "*/15 * * * *",
  "project":        "polymarket",
  "assigned_agent": "market-intel",
  "model":          "nemotron/polymarket",
  "payload":        "BTC/USD 15-minute price prediction with confidence."
}'

# Done. The mamba runs it forever, logs every cost, surfaces failures.`,
  },
  {
    tag:      "EXAMPLE 03",
    title:    "Pipe results anywhere",
    body:     "Done tasks emit an outbound webhook. Wire it to Slack, email, your CRM, an Arweave anchor — whatever. The mamba doesn't care where it ends up.",
    filename: "outbound.json",
    code: `{
  "task_id":      "7a2f9c4d-...",
  "status":       "done",
  "tokens_in":    842,
  "tokens_out":   362,
  "cost_usd":     0.0028,
  "result":       "...",
  "model":        "claude-sonnet-4-6",
  "agent":        "code-reviewer",
  "duration_ms":  1283,
  "chain_anchor": "0x4f2a8d…"
}`,
  },
];

const WHY = [
  {
    q: "Why not just use n8n?",
    a: "n8n is great if you live in the GUI. open-mamba is for people who'd rather POST a task than wire a node. Same outcome, less mouse.",
  },
  {
    q: "Why not just call Claude directly?",
    a: "You can. But then you write the queue, the retry logic, the cost log, the webhook glue, the cron runner, and the dashboard. open-mamba is all of those, in 60 seconds, free.",
  },
  {
    q: "Why is it free?",
    a: "Because the engine doesn't have to be paid to be good. The paid product (taifoon-mamba) layers SSO, audit, and a cost-optimizer on top. The kernel stays open.",
  },
  {
    q: "Why Rust?",
    a: "Because we wanted a single binary you can ship anywhere with no runtime, and DuckDB embeds in Rust without sweat. Also: cargo build works on a plane.",
  },
];
