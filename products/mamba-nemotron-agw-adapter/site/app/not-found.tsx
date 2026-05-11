import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="section-y">
      <div className="container container-prose text-center">
        <p className="eyebrow mb-4">404</p>
        <h1 className="text-h1 mb-4">That route isn&rsquo;t certified.</h1>
        <p className="text-body text-inkSoft mb-8">
          Whatever you were looking for, the adapter has no manifest entry
          for it. Try the home page, the install guide, or the spec.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">Home</Link>
          <Link href="/install" className="btn btn-secondary">Install</Link>
          <Link href="/spec" className="btn btn-secondary">Spec</Link>
        </div>
      </div>
    </div>
  );
}
