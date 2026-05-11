import type { Config } from "tailwindcss";

/**
 * open-mamba.dev — the friendly cousin's design tokens.
 *
 * Family DNA shared with taifoon.io: square corners, JetBrains Mono chrome,
 * silver-on-near-black surfaces. Departures: mint-green primary (the mamba
 * is green, not blue), warmer surfaces, more playful spacing.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1180px" },
    },
    borderRadius: {
      none: "0",
      DEFAULT: "0",
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      full: "9999px",
    },
    extend: {
      colors: {
        // Background ladder — pure black with a faint warmth
        bg:        "rgb(var(--bg) / <alpha-value>)",
        surface:   "rgb(var(--surface) / <alpha-value>)",
        surface2:  "rgb(var(--surface-2) / <alpha-value>)",
        text:      "rgb(var(--text) / <alpha-value>)",
        muted:     "rgb(var(--muted) / <alpha-value>)",

        // Mamba mint green is THE accent
        brand:     "rgb(var(--brand) / <alpha-value>)",
        // Sky blue stays available for "see also: taifoon" callouts
        family:    "rgb(var(--family) / <alpha-value>)",
        // Pink for the snake's tongue / "fun" moments
        accent:    "rgb(var(--accent) / <alpha-value>)",

        success:   "rgb(var(--success) / <alpha-value>)",
        warn:      "rgb(var(--warn) / <alpha-value>)",
        danger:    "rgb(var(--danger) / <alpha-value>)",
        info:      "rgb(var(--info) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(2.75rem, 6vw, 5rem)", { lineHeight: "0.98", letterSpacing: "-0.01em", fontWeight: "300" }],
        "display-lg": ["clamp(2rem, 4vw, 3.25rem)", { lineHeight: "1.02", letterSpacing: "-0.005em", fontWeight: "400" }],
        "display-md": ["clamp(1.5rem, 2.5vw, 2.25rem)", { lineHeight: "1.1", letterSpacing: "0", fontWeight: "500" }],
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "wiggle":  { "0%,100%": { transform: "rotate(-2deg)" }, "50%": { transform: "rotate(2deg)" } },
      },
      animation: {
        "fade-in": "fade-in .35s ease-out both",
        "wiggle":  "wiggle 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
