/**
 * Design tokens — single machine-readable contract for the marketing site.
 *
 * Source of truth for the values is docs/DESIGN_TOKENS.md. This file is
 * imported by tailwind.config.ts and by any component that needs to read
 * tokens at runtime. Do not let the two drift.
 */

export const tokens = {
  color: {
    brand: {
      // Surfaces
      paper: '#F5F1E8',
      paperAlt: '#EFE9DC',
      // Text (deep mamba ink — near-black with green undertone)
      ink: '#1A2421',
      inkSoft: '#36433E',
      inkMuted: '#6E7570',
      // Primary — mamba green
      accent: '#2A6E5E',
      accentDeep: '#1F5145',
      accentSoft: '#BBD3CB',
      // Secondary — bronze (warm metallic companion)
      bronze: '#A66E38',
      bronzeDeep: '#7E5126',
      bronzeSoft: '#E2C7A4',
      // Tertiary — ember (the single warm spark; use sparingly)
      ember: '#C96442',
      emberDeep: '#A24E32',
      emberSoft: '#E8C7B7',
      // Ornament
      gold: '#B68A3E',
      // Structural
      line: '#CDD0C8',
      lineSoft: '#DDE0D8',
    },
    semantic: {
      success: '#3F7D58',
      warning: '#B68A3E',
      danger: '#9B3528',
      info: '#3A6A8A',
    },
    dark: {
      page: '#15201C',
      alt: '#1B2722',
      card: '#22302B',
      textPrimary: '#E1E7DE',
      textSecondary: '#B6BEB5',
      textMuted: '#828A82',
      accent: '#5DA999',
      bronze: '#D29A60',
      ember: '#E18762',
      border: '#33403B',
    },
  },

  font: {
    serif: '"Source Serif 4", "Tiempos Headline", "Iowan Old Style", Georgia, serif',
    sans: '"Inter", "Styrene B", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Geist Mono", "SF Mono", Menlo, Consolas, monospace',
  },

  text: {
    display:    { size: '4rem',     line: '1.05', weight: 400, tracking: '-0.02em' },
    h1:         { size: '3rem',     line: '1.10', weight: 400, tracking: '-0.015em' },
    h2:         { size: '2.25rem',  line: '1.15', weight: 400, tracking: '-0.01em' },
    h3:         { size: '1.5rem',   line: '1.25', weight: 600, tracking: '-0.005em' },
    h4:         { size: '1.25rem',  line: '1.30', weight: 600, tracking: '0' },
    body:       { size: '1.0625rem',line: '1.55', weight: 400, tracking: '0' },
    bodySm:     { size: '0.9375rem',line: '1.55', weight: 400, tracking: '0' },
    caption:    { size: '0.8125rem',line: '1.45', weight: 500, tracking: '0.01em' },
    eyebrow:    { size: '0.75rem',  line: '1.40', weight: 600, tracking: '0.08em' },
    code:       { size: '0.875rem', line: '1.55', weight: 400, tracking: '0' },
  },

  space: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.5rem',
    6: '2rem',
    7: '3rem',
    8: '4rem',
    9: '6rem',
    10: '8rem',
    11: '10rem',
  },

  radius: {
    none: '0',
    sm: '4px',
    md: '6px',
    lg: '10px',
    full: '9999px',
  },

  shadow: {
    none: 'none',
    subtle: '0 1px 2px rgba(31, 30, 27, 0.05)',
    card: '0 2px 8px rgba(31, 30, 27, 0.06), 0 1px 2px rgba(31, 30, 27, 0.04)',
    modal: '0 24px 48px rgba(31, 30, 27, 0.12), 0 4px 12px rgba(31, 30, 27, 0.08)',
  },

  motion: {
    instant: { duration: '0ms', easing: 'linear' },
    fast:    { duration: '120ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    base:    { duration: '200ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    slow:    { duration: '320ms', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  },

  z: {
    base: 0,
    raised: 10,
    sticky: 20,
    dropdown: 30,
    modal: 40,
    toast: 50,
  },

  bp: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

export type Tokens = typeof tokens;
