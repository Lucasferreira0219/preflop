/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Paleta base (chrome) ──────────────────────────────────────────
        bg: "#0B1016",
        surface: {
          1: "#121922",
          2: "#18212C",
          3: "#1E2935", // hover/elevated
        },
        border: {
          DEFAULT: "#273241",
          strong: "#33414F",
        },
        ink: {
          DEFAULT: "#F3F5F7", // text primary
          dim: "#98A6B5", // text secondary
          faint: "#5D6875", // muted / disabled
        },
        // ── Acentos ────────────────────────────────────────────────────────
        gold: "#D2A54A",
        action: {
          blue: "#4D7CFE",
          green: "#4FA36C",
          red: "#D85C5C",
          muted: "#5D6875",
        },
        // ── Escala categórica de ações de poker (range matrix / chips) ──────
        poker: {
          open: "#4FA36C", // raise / rfi
          threebet: "#4D7CFE", // 3-bet
          fourbet: "#9472D4", // 4-bet (violeta sóbrio)
          shove: "#D85C5C", // shove / resteal
          call: "#D2A54A", // call (âmbar/gold)
          fold: "#1B2530", // fold (superfície escura)
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        card: "14px",
        ctl: "10px",
      },
      boxShadow: {
        // Sombras sutis (sem glow) — só profundidade
        card: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
        pop: "0 12px 32px -8px rgba(0,0,0,0.7)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
        "slide-in-right": "slide-in-right 220ms cubic-bezier(0.32,0.72,0,1)",
      },
    },
  },
  plugins: [],
};
