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
        orange: "#C4571C", // CTA / spark accent
        yellow: "#F8CF40", // highlights / live states
        lightblue: "#B1D4E0", // soft accents/tints
        paper: "#EFF3FA", // surfaces
        // semantic aliases (no green in palette)
        success: "#0D5A84",
        warning: "#C4571C",
      },
      fontFamily: {
        sans: ["Quicksand", "system-ui", "sans-serif"],
        display: ["Kollektif", "Quicksand", "sans-serif"],
      },
      borderRadius: {
        brand: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
