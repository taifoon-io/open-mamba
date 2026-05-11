# site/ — marketing site

Next.js 14 (App Router, TypeScript, Tailwind CSS), static export, served by
nginx at https://mamba.taifoon.dev.

## Local dev

```bash
npm ci
npm run dev          # http://localhost:3000
```

## Build

```bash
npm run build        # → ./out (static export)
```

## Deploy

```bash
../deploy/deploy.sh  # builds, pushes via stochastic bridge, reloads nginx
```

## Layout

- `app/` — App Router pages (`/`, `/spec`, `/install`, `/pricing`, `/not-found`)
- `components/` — `Nav`, `Footer`, `Hero`, `FeatureGrid`, `CodeBlock`,
  `CTA`, `Badge`, `ArchitectureDiagram`
- `lib/tokens.ts` — design tokens (single source of truth — see
  [`docs/DESIGN_TOKENS.md`](../docs/DESIGN_TOKENS.md))
- `app/globals.css` — base styles, prose styles, component classes,
  reduced-motion handling
- `tailwind.config.ts` — bridges tokens into Tailwind utilities
- `next.config.mjs` — `output: 'export'`, image optimizer disabled,
  `poweredByHeader: false`, strict mode on

## Conventions

1. **Never hardcode a hex / px / line-height.** Add the token if needed.
2. **Two weights only** — 400 Regular, 600 Semibold. Italic in serif only.
3. **One accent.** `brand.accent` (`#C96442`) for primary CTA, key links,
   eyebrows. No second accent.
4. **Section padding** uses the `section-y` utility (64 → 96 → 128 px
   responsive). Container uses `container` (max-w 1200, padded gutters).
5. **Reduced motion** is respected globally in `globals.css`.
