import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata = { title: "Docs" };

const SECTIONS = [
  {
    label: "GET STARTED",
    items: [
      { title: "Install",          body: "macOS, Linux, Windows. Brew, cargo, or a single static binary.", href: "https://github.com/yawningmonsoon/open-mamba#install" },
      { title: "Quickstart",       body: "Submit your first task in under 60 seconds.",                     href: "https://github.com/yawningmonsoon/open-mamba#quickstart" },
      { title: "TaskEnvelope",     body: "The shape of every task — project, agent, model, payload.",       href: "https://github.com/yawningmonsoon/open-mamba#envelope" },
    ],
  },
  {
    label: "TRIGGERS",
    items: [
      { title: "Webhooks",  body: "Fire workflows from GitHub, Discord, Stripe, or any HTTP source.", href: "https://github.com/yawningmonsoon/open-mamba#webhooks" },
      { title: "Cron",      body: "Recurring jobs with timezone-aware crontab syntax.",               href: "https://github.com/yawningmonsoon/open-mamba#cron"     },
      { title: "Direct CLI",body: "mamba submit < task.json. Pipe-friendly, scriptable.",             href: "https://github.com/yawningmonsoon/open-mamba#cli"      },
    ],
  },
  {
    label: "INFERENCE",
    items: [
      { title: "Claude (via openfang)", body: "Uses your local claude CLI. No keys leave your laptop.",                  href: "https://github.com/yawningmonsoon/open-mamba#claude"   },
      { title: "Nemotron",              body: "Bring your own vLLM / Ollama / TGI host, or use taifoon-intel adapters.", href: "/docs/intel" },
      { title: "Routing",               body: "Pick a model per task or let a simple rule decide.",                       href: "https://github.com/yawningmonsoon/open-mamba#routing"  },
    ],
  },
  {
    label: "OPS",
    items: [
      { title: "Observability", body: "Tokens, cost, latency, by project / agent / model. Live at :1337.", href: "https://github.com/yawningmonsoon/open-mamba#obs"     },
      { title: "Backups",       body: "DuckDB snapshots, PITR, cold storage off-box.",                     href: "https://github.com/yawningmonsoon/open-mamba#backups" },
      { title: "Self-hosting",  body: "systemd, Docker, fly.io, Raspberry Pi.",                            href: "https://github.com/yawningmonsoon/open-mamba#deploy"  },
    ],
  },
];

export default function Page() {
  return (
    <>
      <Nav />
      <main className="container-tight py-20">
        <div className="max-w-3xl">
          <div className="bracketed mb-4">DOCS · LIVING ON GITHUB</div>
          <h1 className="text-display-lg text-text">
            The docs. <span className="text-brand">Mostly on GitHub.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-text/65">
            We hate stale docs. So the source of truth is the README — it lives
            with the code, gets reviewed with every PR, and won't drift. This
            page is the index.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://github.com/yawningmonsoon/open-mamba"
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              READ_ON_GITHUB ↗
            </a>
            <Link href="/" className="btn-ghost">
              BACK_TO_HOME
            </Link>
          </div>
        </div>

        <div className="mt-12 max-w-3xl">
          <CodeBlock filename="quickstart.sh">{`git clone https://github.com/yawningmonsoon/open-mamba.git && cd open-mamba
cargo build --release --bin open-mamba
sudo ln -sf "$PWD/scripts/mamba" /usr/local/bin/mamba
mamba up                                  # binds :1337 with dashboard
open http://localhost:1337                # the live console
curl -X POST :1337/ingest -d @task.json   # drop work in`}</CodeBlock>
        </div>

        <div className="mt-16 space-y-12">
          {SECTIONS.map((s) => (
            <section key={s.label}>
              <div className="bracketed mb-5">{s.label}</div>
              <div className="grid gap-px bg-text/[0.06] md:grid-cols-3 border border-text/[0.06]">
                {s.items.map((i) => (
                  <a
                    key={i.title}
                    href={i.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group bg-bg p-5 hover:bg-surface/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[13px] font-bold tracking-[0.1em] uppercase text-text">
                        {i.title}
                      </div>
                      <span className="text-text/30 group-hover:text-brand transition-colors">↗</span>
                    </div>
                    <p className="mt-2 text-[13px] text-text/60 leading-relaxed">{i.body}</p>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
