import type { Config } from "tailwindcss";

// Brand tokens come straight from the LSI Media brand board (spec). No green:
// success/valid uses primary blue; warnings use orange.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#343433", // primary gray (text)
        nav: "#0A3A56", // deep nav (dark surfaces)
        blue: {
          DEFAULT: "#0D5A84", // primary blue
          bright: "#1A7AAB",
        },
        nav2: "#072B40", // deepest nav (gradient end)
        orange: "#C4571C", // CTA / spark accent
        yellow: "#F8CF40", // highlights / live states
        lightblue: "#B1D4E0", // soft accents/tints
        cyan: "#B1D4E0", // brand light-blue accent (semantic alias)
        paper: "#EFF3FA", // surfaces
        paper2: "#E2EAF4", // slightly deeper surface tint
        // semantic aliases (no green in palette)
        success: "#0D5A84",
        warning: "#C4571C",
        // data-viz status ramp (no green). Encode state in more than color —
        // always pair with an icon/label/shape per WCAG 1.4.1.
        status: {
          good: "#0D5A84", // primary blue = healthy/pass
          info: "#F8CF40", // yellow = scheduled/info
          warn: "#C4571C", // orange = attention
          critical: "#C0392B", // red = failing/destructive
        },
        // sequential blue ramp for heatmaps/choropleth-style cells + gradients
        seq: {
          50: "#EAF2F7",
          100: "#B1D4E0",
          200: "#6FA8C4",
          300: "#2E7BA6",
          400: "#0D5A84",
          500: "#0A3A56",
        },
      },
      fontFamily: {
        sans: ["Quicksand", "system-ui", "sans-serif"],
        display: ["Kollektif", "Quicksand", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        brand: "16px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(10, 58, 86, 0.06)",
        md: "0 4px 12px -2px rgba(10, 58, 86, 0.10)",
        lg: "0 12px 32px -8px rgba(10, 58, 86, 0.16)",
        // colored glow for "live"/hot instrument states
        glow: "0 0 0 1px rgba(248, 207, 64, 0.35), 0 0 18px -2px rgba(248, 207, 64, 0.45)",
        "glow-blue": "0 0 0 1px rgba(26, 122, 171, 0.35), 0 0 18px -2px rgba(26, 122, 171, 0.45)",
      },
      keyframes: {
        "fill-bar": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fill-bar": "fill-bar 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.5s infinite",
        "toast-in": "toast-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 220ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
