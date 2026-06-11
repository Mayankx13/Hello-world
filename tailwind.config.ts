import type { Config } from "tailwindcss";

/**
 * AiEZ design tokens — mirrors the CSS custom properties in app/globals.css.
 * Cream/ink editorial palette with a burnt-sienna accent. No gradients, no glass.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FAF7F0",
          deep: "#F2EDE2",
        },
        ink: "#1A1A1A",
        muted: "#5C5850",
        accent: {
          DEFAULT: "#B3552D",
          deep: "#8F421F", // AA-safe for small text on cream
        },
        line: {
          DEFAULT: "rgba(26, 26, 26, 0.16)",
          soft: "rgba(26, 26, 26, 0.09)",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: [
          "var(--font-instrument)",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        plate: "1240px",
        measure: "34em",
      },
    },
  },
  plugins: [],
};

export default config;
