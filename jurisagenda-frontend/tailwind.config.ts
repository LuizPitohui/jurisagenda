import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  "#f0f4f9",
          100: "#dce6f0",
          200: "#b8cce0",
          300: "#8aaec9",
          400: "#5a8cb0",
          500: "#3a6d96",
          600: "#2a567a",
          700: "#1e3f5c",
          800: "#162d42",
          900: "#0e1e2e",
          950: "#080f18",
        },
        cream: {
          50:  "#fdfcf8",
          100: "#f9f6ee",
          200: "#f3ecdb",
          300: "#e9dfc4",
          400: "#d9c99a",
        },
        audiencia: "#DC2626",
        reuniao:   "#2563EB",
        prazo:     "#CA8A04",
        contrato:  "#16A34A",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans:  ["var(--font-sans)",  "system-ui", "sans-serif"],
        mono:  ["var(--font-mono)",  "monospace"],
      },
      animation: {
        "fade-up":   "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":   "fadeIn 0.3s ease both",
        "tv-entry":  "tvEntry 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
        "wave-bar":  "waveBar 0.8s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeUp:  { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        tvEntry: { from: { opacity: "0", transform: "scale(0.85) translateY(24px)" }, to: { opacity: "1", transform: "scale(1) translateY(0)" } },
        waveBar: { from: { transform: "scaleY(0.3)" }, to: { transform: "scaleY(1)" } },
      },
      boxShadow: {
        card:  "0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        modal: "0 24px 80px rgba(0,0,0,0.22)",
        tv:    "0 0 60px rgba(37,99,235,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;