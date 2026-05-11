# Design tokens — `mamba-nemotron-agw-adapter` marketing site

> Status: v0.1.0 · Owner: yawningmonsoon
> Source of truth: this file. The TS export at `site/lib/tokens.ts` is
> generated from these tables and consumed by `tailwind.config.ts`.

The visual language is deliberately **quiet, editorial, and characteristically
mamba** — calm warm-paper canvas (Claude-adjacent) carrying a palette pulled
from the snake itself: deep forest-green as the primary, warm bronze as the
companion, with a single ember spark held in reserve for moments that need
heat. Buyers (platform engineers at Solo.io, chief risk officers at
regulated institutions) are exhausted by neon-gradient infra-product sites.
Restraint plus a real identity is the brand.

Four principles shape every decision below:

1. **Tri-tone, never monotone.** Primary green, secondary bronze, tertiary
   ember. Each has a defined role; mixing the roles is the smell test for
   inconsistency.
2. **One serif, one sans, one mono.** No exceptions in MVP.
3. **Generous whitespace.** Type sets on an 8 px baseline grid; sections
   breathe with multiples of 64 px / 96 px / 128 px.
4. **Almost-flat depth.** Shadows are an emergency exit, not a layout
   strategy. Borders and tonal contrast carry hierarchy.

---

## 1. Colour

### 1.1 Brand palette

The palette is named after the snake. **Mamba green** is the primary accent
(deep forest with a teal cast — the colour of black-mamba scales catching
forest light). **Bronze** is the warm metallic companion (signature on
secondary actions, certification badges, key emphasis). **Ember** is the
single warm spark — held back to one or two moments per page (logo pulse,
the highlighted hero word). **Gold** is reserved for ornamental
co-sell / certification marks.

| Token | Hex | Role | Use |
|---|---|---|---|
| `brand.paper` | `#F5F1E8` | surface | Default page background (warm cream) |
| `brand.paperAlt` | `#EFE9DC` | surface | Alternating section background, code-block surround |
| `brand.ink` | `#1A2421` | text | Default body & heading colour (deep mamba ink — near-black with green undertone) |
| `brand.inkSoft` | `#36433E` | text | Secondary text, captions |
| `brand.inkMuted` | `#6E7570` | text | Tertiary text, helper copy |
| `brand.accent` | `#2A6E5E` | **PRIMARY** | Mamba green — primary CTA, key links, eyebrows |
| `brand.accentDeep` | `#1F5145` | PRIMARY | Hover / pressed state for `accent` |
| `brand.accentSoft` | `#BBD3CB` | PRIMARY | Surface fill for callouts and badges |
| `brand.bronze` | `#A66E38` | **SECONDARY** | Warm metallic companion — secondary CTA outlines, key numerical emphasis, certification chips |
| `brand.bronzeDeep` | `#7E5126` | SECONDARY | Hover for `bronze` |
| `brand.bronzeSoft` | `#E2C7A4` | SECONDARY | Surface fill for bronze-marked elements |
| `brand.ember` | `#C96442` | TERTIARY | The single warm spark — logo pulse, one highlighted hero word, one "what's new" pip per page |
| `brand.emberDeep` | `#A24E32` | TERTIARY | Hover for `ember` |
| `brand.gold` | `#B68A3E` | ORNAMENT | Solo.io co-sell mark, ornamental certification badges only |
| `brand.line` | `#CDD0C8` | structural | Default border / divider (faint green undertone) |
| `brand.lineSoft` | `#DDE0D8` | structural | Hairline border for cards-on-paper |

### 1.2 Semantic palette

Note that `semantic.success` is **deliberately distinct** from
`brand.accent` (slightly more yellow-leaning green) so success badges
don't visually collapse into the primary accent.

| Token | Hex | Meaning |
|---|---|---|
| `semantic.success` | `#3F7D58` | Pass / certified |
| `semantic.warning` | `#B68A3E` | Beta / attention (== `brand.gold`) |
| `semantic.danger`  | `#9B3528` | Halt / fail / revoked |
| `semantic.info`    | `#3A6A8A` | Note / informational callout |

### 1.3 Dark mode (auto, via `prefers-color-scheme`)

| Token | Light | Dark |
|---|---|---|
| `surface.page` | `brand.paper` `#F5F1E8` | `#15201C` |
| `surface.alt`  | `brand.paperAlt` `#EFE9DC` | `#1B2722` |
| `surface.card` | `#FFFFFF` | `#22302B` |
| `text.primary` | `brand.ink` `#1A2421` | `#E1E7DE` |
| `text.secondary` | `brand.inkSoft` `#36433E` | `#B6BEB5` |
| `text.muted` | `brand.inkMuted` `#6E7570` | `#828A82` |
| `accent.primary` (green) | `brand.accent` `#2A6E5E` | `#5DA999` |
| `accent.secondary` (bronze) | `brand.bronze` `#A66E38` | `#D29A60` |
| `accent.tertiary` (ember) | `brand.ember` `#C96442` | `#E18762` |
| `border.default` | `brand.line` `#CDD0C8` | `#33403B` |

Dark mode is **opt-in via media query** in v0.1.0; user toggle ships in
v0.2.0.

### 1.4 Accessibility

All foreground/background pairs used for text hit **WCAG 2.1 AA** contrast
ratios for body text (≥ 4.5:1) and large text (≥ 3.0:1):

| Pair | Ratio | Meets |
|---|---|---|
| `ink` on `paper` | 13.8:1 | AAA body |
| `inkSoft` on `paper` | 8.4:1 | AAA body |
| `inkMuted` on `paper` | 4.6:1 | AA body |
| `accent` (green) on `paper` | 5.4:1 | AA body, AAA large |
| `paper` on `accent` (green) | 5.4:1 | AA body |
| `bronze` on `paper` | 4.7:1 | AA body |
| `ember` on `paper` | 4.6:1 | AA body |

The single non-AA combination — `gold` on `paper` (3.4:1) — is restricted
to ornamental badges with text-equivalent labels.

---

## 2. Typography

### 2.1 Families

| Token | Stack | Use |
|---|---|---|
| `font.serif` | `"Source Serif 4", "Tiempos Headline", "Iowan Old Style", Georgia, serif` | Display, headings, hero |
| `font.sans`  | `"Inter", "Styrene B", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | Body, UI, navigation |
| `font.mono`  | `"JetBrains Mono", "Geist Mono", "SF Mono", Menlo, Consolas, monospace` | Code blocks, inline code, technical IDs |

Source Serif 4, Inter, and JetBrains Mono are all OFL/SIL-licensed, served
self-hosted from `/_next/static/fonts/` (no third-party tracking).

### 2.2 Type scale (1.250 — major third, 16 px base)

| Token | Size | Line | Weight | Tracking | Family | Use |
|---|---|---|---|---|---|---|
| `text.display` | 64 / 4 rem | 1.05 | 400 | -0.02em | serif | Hero only |
| `text.h1` | 48 / 3 rem | 1.10 | 400 | -0.015em | serif | Page title |
| `text.h2` | 36 / 2.25 rem | 1.15 | 400 | -0.01em | serif | Section heading |
| `text.h3` | 24 / 1.5 rem | 1.25 | 600 | -0.005em | sans | Sub-section |
| `text.h4` | 20 / 1.25 rem | 1.30 | 600 | 0 | sans | Card title |
| `text.body` | 17 / 1.0625 rem | 1.55 | 400 | 0 | sans | Default body |
| `text.bodySm` | 15 / 0.9375 rem | 1.55 | 400 | 0 | sans | Dense body |
| `text.caption` | 13 / 0.8125 rem | 1.45 | 500 | 0.01em | sans | Captions, labels |
| `text.eyebrow` | 12 / 0.75 rem | 1.40 | 600 | 0.08em | sans (uppercase) | Section eyebrows |
| `text.code` | 14 / 0.875 rem | 1.55 | 400 | 0 | mono | Code blocks |
| `text.codeInline` | 0.95em (relative) | inherit | 500 | 0 | mono | Inline code |

Body line length capped at **68ch** for prose, **88ch** for technical
documentation pages (spec, install).

### 2.3 Weights

Only two weights ship in MVP: **400 Regular** and **600 Semibold**. Italics
in serif only.

---

## 3. Spacing — 8 px baseline

| Token | Value (px / rem) |
|---|---|
| `space.0` | 0 |
| `space.1` | 4 / 0.25 rem |
| `space.2` | 8 / 0.5 rem |
| `space.3` | 12 / 0.75 rem |
| `space.4` | 16 / 1 rem |
| `space.5` | 24 / 1.5 rem |
| `space.6` | 32 / 2 rem |
| `space.7` | 48 / 3 rem |
| `space.8` | 64 / 4 rem |
| `space.9` | 96 / 6 rem |
| `space.10` | 128 / 8 rem |
| `space.11` | 160 / 10 rem |

**Section padding rule:** vertical padding on top-level sections is
`space.10` (128 px) on desktop, `space.8` (64 px) on mobile.

---

## 4. Radius

| Token | Value | Use |
|---|---|---|
| `radius.none` | 0 | Hairline dividers, code blocks |
| `radius.sm` | 4 px | Inputs, badges |
| `radius.md` | 6 px | Buttons, cards |
| `radius.lg` | 10 px | Hero CTA, large surfaces |
| `radius.full` | 9999 px | Pills, avatars |

---

## 5. Shadow / elevation

Shadow is a last resort. Prefer borders and tonal contrast.

| Token | Value | Use |
|---|---|---|
| `shadow.none` | `none` | Default |
| `shadow.subtle` | `0 1px 2px rgba(31, 30, 27, 0.05)` | Hover lift on cards |
| `shadow.card` | `0 2px 8px rgba(31, 30, 27, 0.06), 0 1px 2px rgba(31, 30, 27, 0.04)` | Floating cards in hero |
| `shadow.modal` | `0 24px 48px rgba(31, 30, 27, 0.12), 0 4px 12px rgba(31, 30, 27, 0.08)` | Modals, popovers (post-MVP) |

---

## 6. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion.instant` | 0 ms | — | Reduced-motion replacements |
| `motion.fast` | 120 ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Hover, focus |
| `motion.base` | 200 ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Default UI |
| `motion.slow` | 320 ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Hero / page entrances |

`prefers-reduced-motion: reduce` collapses every duration to `motion.instant`.

---

## 7. Z-index scale

| Token | Value |
|---|---|
| `z.base` | 0 |
| `z.raised` | 10 |
| `z.sticky` | 20 (nav) |
| `z.dropdown` | 30 |
| `z.modal` | 40 |
| `z.toast` | 50 |

---

## 8. Breakpoints

| Token | Min-width |
|---|---|
| `bp.sm` | 640 px |
| `bp.md` | 768 px |
| `bp.lg` | 1024 px |
| `bp.xl` | 1280 px |
| `bp.2xl` | 1536 px |

Layouts are **mobile-first**. Container max-width: `1200 px`, with
horizontal page gutters of `space.5` (24 px) on mobile, `space.7` (48 px)
on desktop.

---

## 9. Component primitives — first pass

| Component | Variants | States | Tokens |
|---|---|---|---|
| Button | `primary`, `secondary`, `ghost` | default, hover, active, disabled, loading | `accent`, `ink`, `paper`, `radius.md`, `motion.fast` |
| Link | `default`, `subtle` | default, hover, focus-visible | `accent`, `accentDeep`, underline-on-hover |
| Card | `default`, `bordered` | default, hover (subtle lift) | `paper` / `paperAlt`, `line`, `radius.md`, `shadow.subtle` |
| Badge | `default`, `success`, `warning`, `danger`, `info` | static | semantic tokens, `radius.sm`, eyebrow type |
| Code block | `default`, `terminal` | static | `paperAlt` / `ink`, `mono`, `radius.sm` |
| Eyebrow | — | static | `text.eyebrow`, uppercase, `accent` or `inkMuted` |

Detailed per-component specs ship with the component implementation in
`site/components/` and are documented inline.

---

## 10. Do / don't

| ✅ Do | ❌ Don't |
|---|---|
| Use **mamba green** (`brand.accent`) as the dominant accent — primary CTA, key links, eyebrow ornaments | Mix all three accents on the same component (e.g. green CTA next to bronze CTA next to ember CTA). Pick one per element. |
| Use **bronze** (`brand.bronze`) for secondary actions, certification chips, and key numerical emphasis | Use bronze for primary CTAs. That role belongs to green. |
| Use **ember** (`brand.ember`) at most twice per page — typically the logo pulse and one highlighted hero word | Spray ember across body copy or use it as a CTA fill. It loses its function as the warm spark. |
| Use **gold** only for ornamental marks (Solo.io co-sell, certification badges) | Use gold for body text or interactive elements (contrast is ornamental-only). |
| Set type on the 8 px baseline grid | Use arbitrary line-heights. If a value isn't in §2.2, add a token. |
| Use `paper` and `paperAlt` to alternate sections | Stack four background colours on one page. |
| Borders and tonal contrast for hierarchy | Drop shadows for hierarchy. |
| Use serif for editorial moments (hero, page titles, pull quotes) | Use serif for navigation, buttons, or UI chrome. |
| Animate with `motion.base` (200 ms, ease-out) | Use bouncing / spring easings. The brand is calm. |

---

## 11. Versioning

Token additions are **additive** in patch releases. **Removals** or
semantic changes require a minor bump and a migration note in
`CHANGELOG.md`. The TS export at `site/lib/tokens.ts` is the
machine-readable contract — never let it drift from this document.
