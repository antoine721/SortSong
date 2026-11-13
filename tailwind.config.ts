import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      colors: {
        bg: { DEFAULT: "#0b0b0f", 1: "#111118", 2: "#17171f", 3: "#1f1f2a", 4: "#2a2a37" },
        line: "#262632",
        fg: { DEFAULT: "#ececf1", 2: "#a1a1b0", 3: "#6b6b7b" },
        accent: { DEFAULT: "#7c5cff", 2: "#9b83ff", soft: "rgba(124,92,255,0.15)" },
      },
      boxShadow: { soft: "0 8px 30px rgba(0,0,0,0.35)" },
    },
  },
  plugins: [],
} satisfies Config;
