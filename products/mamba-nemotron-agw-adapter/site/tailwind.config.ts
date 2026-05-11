import type { Config } from 'tailwindcss';
import { tokens } from './lib/tokens';

/**
 * Tailwind config bridges the design tokens in lib/tokens.ts into utility
 * classes. The tokens file is the single source of truth — do not hardcode
 * values here. If you need a new token, add it to docs/DESIGN_TOKENS.md
 * AND lib/tokens.ts, then surface it here.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'media',
  theme: {
    screens: tokens.bp,
    container: {
      center: true,
      padding: { DEFAULT: '1.5rem', md: '3rem' },
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        paper: tokens.color.brand.paper,
        paperAlt: tokens.color.brand.paperAlt,
        ink: tokens.color.brand.ink,
        inkSoft: tokens.color.brand.inkSoft,
        inkMuted: tokens.color.brand.inkMuted,
        // Primary — mamba green
        accent: tokens.color.brand.accent,
        accentDeep: tokens.color.brand.accentDeep,
        accentSoft: tokens.color.brand.accentSoft,
        // Secondary — bronze
        bronze: tokens.color.brand.bronze,
        bronzeDeep: tokens.color.brand.bronzeDeep,
        bronzeSoft: tokens.color.brand.bronzeSoft,
        // Tertiary — ember
        ember: tokens.color.brand.ember,
        emberDeep: tokens.color.brand.emberDeep,
        emberSoft: tokens.color.brand.emberSoft,
        // Ornament
        gold: tokens.color.brand.gold,
        // Structural
        line: tokens.color.brand.line,
        lineSoft: tokens.color.brand.lineSoft,
        // Semantic
        success: tokens.color.semantic.success,
        warning: tokens.color.semantic.warning,
        danger: tokens.color.semantic.danger,
        info: tokens.color.semantic.info,
        // Dark-mode counterparts available via .dark: utilities
        'dark-page': tokens.color.dark.page,
        'dark-alt': tokens.color.dark.alt,
        'dark-card': tokens.color.dark.card,
        'dark-text': tokens.color.dark.textPrimary,
        'dark-textSoft': tokens.color.dark.textSecondary,
        'dark-textMuted': tokens.color.dark.textMuted,
        'dark-accent': tokens.color.dark.accent,
        'dark-bronze': tokens.color.dark.bronze,
        'dark-ember': tokens.color.dark.ember,
        'dark-border': tokens.color.dark.border,
      },
      fontFamily: {
        serif: tokens.font.serif.split(',').map((s) => s.trim().replace(/['"]/g, '')),
        sans: tokens.font.sans.split(',').map((s) => s.trim().replace(/['"]/g, '')),
        mono: tokens.font.mono.split(',').map((s) => s.trim().replace(/['"]/g, '')),
      },
      fontSize: {
        display:  [tokens.text.display.size,  { lineHeight: tokens.text.display.line,  letterSpacing: tokens.text.display.tracking,  fontWeight: tokens.text.display.weight }],
        h1:       [tokens.text.h1.size,       { lineHeight: tokens.text.h1.line,       letterSpacing: tokens.text.h1.tracking,       fontWeight: tokens.text.h1.weight }],
        h2:       [tokens.text.h2.size,       { lineHeight: tokens.text.h2.line,       letterSpacing: tokens.text.h2.tracking,       fontWeight: tokens.text.h2.weight }],
        h3:       [tokens.text.h3.size,       { lineHeight: tokens.text.h3.line,       letterSpacing: tokens.text.h3.tracking,       fontWeight: tokens.text.h3.weight }],
        h4:       [tokens.text.h4.size,       { lineHeight: tokens.text.h4.line,       letterSpacing: tokens.text.h4.tracking,       fontWeight: tokens.text.h4.weight }],
        body:     [tokens.text.body.size,     { lineHeight: tokens.text.body.line,     letterSpacing: tokens.text.body.tracking,     fontWeight: tokens.text.body.weight }],
        bodySm:   [tokens.text.bodySm.size,   { lineHeight: tokens.text.bodySm.line,   letterSpacing: tokens.text.bodySm.tracking,   fontWeight: tokens.text.bodySm.weight }],
        caption:  [tokens.text.caption.size,  { lineHeight: tokens.text.caption.line,  letterSpacing: tokens.text.caption.tracking,  fontWeight: tokens.text.caption.weight }],
        eyebrow:  [tokens.text.eyebrow.size,  { lineHeight: tokens.text.eyebrow.line,  letterSpacing: tokens.text.eyebrow.tracking,  fontWeight: tokens.text.eyebrow.weight }],
        code:     [tokens.text.code.size,     { lineHeight: tokens.text.code.line,     letterSpacing: tokens.text.code.tracking,     fontWeight: tokens.text.code.weight }],
      },
      spacing: {
        section: tokens.space[10],
        sectionMobile: tokens.space[8],
      },
      borderRadius: {
        none: tokens.radius.none,
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
        full: tokens.radius.full,
      },
      boxShadow: {
        subtle: tokens.shadow.subtle,
        card: tokens.shadow.card,
        modal: tokens.shadow.modal,
      },
      transitionDuration: {
        fast: tokens.motion.fast.duration,
        base: tokens.motion.base.duration,
        slow: tokens.motion.slow.duration,
      },
      transitionTimingFunction: {
        ease: tokens.motion.base.easing,
        slow: tokens.motion.slow.easing,
      },
      maxWidth: {
        prose: '68ch',
        proseTechnical: '88ch',
      },
    },
  },
  plugins: [],
};

export default config;
