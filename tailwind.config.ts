import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08090c",
        panel: "#0f1218",
        panel2: "#141922",
        line: "#232a35",
        silver: "#e8edf5",
        muted: "#8b97a8",
        brand: "#164BFF",
        ok: "#35d39a",
        warn: "#f2c14e",
        bad: "#ff6b6b",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 40px -30px rgba(0,0,0,0.9)",
      },
    },
  },
  plugins: [],
};

export default config;
