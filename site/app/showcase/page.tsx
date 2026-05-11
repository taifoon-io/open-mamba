import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { MambaMark } from "@/components/Logo";

export const metadata = { title: "Showcase" };

const CASES = [
  {
    n: "01",
    who: "spinner",
    what: "Autonomous PR review on a 12-repo monorepo",
    body: "Every PR fires a webhook. open-mamba runs claude-sonnet against the diff, posts a structured review to a Slack thread. Average $0.003 per PR. ~400 PRs/mo.",
    metric: { v: "$1.20", l: "MONTHLY_BILL" },
    tag: "GITHUB · CLAUDE · SLACK",
  },
  {
    n: "02",
    who: "polymarket-quant",
    what: "15-minute crypto signals on a cron",
    body: "Cron fires every 15 minutes. The polymarket Nemotron adapter outputs a BTC/USD prediction with a confidence score, piped into a TradingView alert webhook.",
    metric: { v: "0.74", l: "TOK_PER_SEC" },
    tag: "CRON · NEMOTRON · TRADINGVIEW",
  },
  {
    n: "03",
    who: "algotrada",
    what: "Cross-DEX arbitrage scout",
    body: "Genome stream events fire mamba tasks. The algotrada adapter scores opportunities; profitable ones are anchored to V5 with a chain receipt before execution.",
    metric: { v: "412", l: "TASKS_TODAY" },
    tag: "GENOME · ADAPTER · CHAIN_ANCHOR",
  },
];

export default function Page() {
  return (
    <>
      <Nav />
      <main className="container-tight py-20">
        <div className="max-w-3xl">
          <div className="bracketed mb-4">SHOWCASE</div>
          <h1 className="text-display-lg text-text">
            What people actually <span className="text-brand">do with it.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-text/65">
            Three real workflows running in production right now. Boring,
            useful, cheap. Open a PR if you want yours added.
          </p>
        </div>

        <div className="mt-14 space-y-6">
          {CASES.map((c) => (
            <article
              key={c.n}
              className="border border-text/[0.06] bg-surface/30 hover:bg-surface/50 transition-colors"
            >
              <div className="grid gap-6 p-7 md:grid-cols-[80px_1fr_180px] md:items-start">
                <div>
                  <div className="font-mono text-[12px] tracking-[0.22em] text-brand">CASE</div>
                  <div className="mt-1 font-mono text-[24px] font-thin text-text">{c.n}</div>
                </div>
                <div>
                  <div className="font-mono text-[11px] tracking-[0.18em] text-text/45">{c.tag}</div>
                  <div className="mt-1 font-mono text-[12px] tracking-[0.16em] text-brand">@{c.who}</div>
                  <h2 className="mt-2 text-lg font-semibold text-text">{c.what}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-text/65">{c.body}</p>
                </div>
                <div className="border-l border-text/[0.06] pl-5">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-text/45">{c.metric.l}</div>
                  <div className="mt-2 font-mono text-[28px] font-thin text-text">{c.metric.v}</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-20 border border-text/[0.08] bg-surface/30 p-10 text-center">
          <MambaMark size={42} className="mx-auto" />
          <h2 className="mt-5 text-display-md text-text">
            Got a workflow? <span className="text-brand">Send a PR.</span>
          </h2>
          <p className="mt-2 text-sm text-text/60">
            We will roast it kindly and probably add it here.
          </p>
          <a
            href="https://github.com/yawningmonsoon/open-mamba/discussions/new"
            target="_blank"
            rel="noreferrer"
            className="btn-primary mt-6 px-5"
          >
            START_A_THREAD ↗
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
