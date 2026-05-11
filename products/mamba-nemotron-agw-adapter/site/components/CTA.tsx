import Link from 'next/link';

export function CTA() {
  return (
    <section className="section-y mt-16 border-t border-lineSoft dark:border-dark-border">
      <div className="container">
        <div className="grid gap-10 lg:grid-cols-12 items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow mb-5">Pilot the adapter</p>
            <h2 className="text-h2 max-w-[22ch] text-balance mb-5">
              Run it on your DGX cluster. With us in the room.
            </h2>
            <p className="max-w-prose text-body text-inkSoft text-pretty">
              Design partners get hands-on integration support, named
              compliance mapping for your jurisdiction, and a co-authored
              solution brief for the cluster you actually run.
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-wrap gap-3 lg:justify-end">
            <a href="mailto:maciej@t3rn.io?subject=mamba-nemotron-agw-adapter%20pilot" className="btn btn-primary">
              maciej@t3rn.io
            </a>
            <Link href="/spec" className="btn btn-secondary">Read the spec first</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
