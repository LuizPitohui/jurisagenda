import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  safelist: [
    'dark:bg-[#1a2840]',
    'dark:bg-[#162030]',
    'dark:bg-[#0f1923]',
    'dark:border-[#243550]',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  "#f0f5fb",
          100: "#dce8f4",
          200: "#b8d0e8",
          300: "#8ab2d4",
          400: "#5a90bc",
          500: "#3a72a0",
          600: "#2a5a84",
          700: "#1e4a73",
          800: "#163352",
          900: "#0b1929",
          950: "#060d16",
        },
        cream: {
          50:  "#fdfcf8",
          100: "#f4f6f9",
          200: "#e8eef5",
          300: "#d5e0ec",
          400: "#b8cfe0",
        },
        gold: {
          400: "#d4a843",
          500: "#c9a84c",
          600: "#b8962a",
        },
        audiencia: "#e53e3e",
        reuniao:   "#3182ce",
        prazo:     "#d69e2e",
        contrato:  "#38a169",
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