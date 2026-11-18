import type { Config } from "tailwindcss";

/** Couleurs pilotées par des variables CSS : thème sombre (défaut historique) ou « discret » (clair, style portail). */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      colors: {
        bg: { DEFAULT: v("bg"), 1: v("bg-1"), 2: v("bg-2"), 3: v("bg-3"), 4: v("bg-4") },
        line: v("line"),
        fg: { DEFAULT: v("fg"), 2: v("fg-2"), 3: v("fg-3") },
        accent: { DEFAULT: v("accent"), 2: v("accent-2"), soft: "rgb(var(--accent) / 0.13)" },
      },
      boxShadow: { soft: "var(--shadow-soft)" },
    },
  },
  plugins: [],
} satisfies Config;
