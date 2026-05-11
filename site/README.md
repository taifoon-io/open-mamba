# open-mamba.dev — the standalone marketing site

A Next.js site that ships inside the `open-mamba` repo. Lives at
**[open-mamba.dev](https://open-mamba.dev)** in production. n8n / openfang.sh
voice — friendly, dev-first, no enterprise pretension.

## Run

```bash
cd site
npm install
npm run dev          # → http://localhost:4040
```

## Build

```bash
npm run build
npm run start
```

## Why a separate site?

The taifoon-os marketing site (at `~/projects/taifoon-mamba/ui`) sells the
commercial Pro tier under the umbrella brand. **open-mamba.dev is the friendly
free cousin** — its own surface, its own voice, its own mint-green palette,
zero pricing tables. If you're a hobbyist who just wants to run agents on
your laptop, you land here. If you outgrow self-hosting, the footer points
you to the family.

## Stack

- Next.js 14 (App Router) + Tailwind + TypeScript strict
- Inter + JetBrains Mono via Google Fonts
- Mint-green primary (`#34D399`), pure black surface, square corners
- One-file design system in `app/globals.css` + `tailwind.config.ts`

## File map

```
site/
├── app/
│   ├── globals.css                  # design tokens
│   ├── layout.tsx                   # root html + meta
│   ├── page.tsx                     # homepage
│   ├── docs/page.tsx                # docs index → links to GitHub README
│   └── showcase/page.tsx            # 3 real workflows
├── components/
│   ├── Logo.tsx                     # smiley pixel-snake mamba mark
│   ├── Nav.tsx
│   ├── Footer.tsx
│   ├── CodeBlock.tsx                # copy-able shell blocks
│   └── WorkflowBlock.tsx            # n8n-style 5-node SVG
├── package.json
└── tailwind.config.ts
```

## License

MIT — same as the engine.
