import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", md: "1.5rem", lg: "2rem" }, screens: { "2xl": "1320px" } },
    extend: {
      colors: {
        ivory: "#FBF8F3",
        cream: "#F4EEE5",
        linen: "#EAE1D3",
        sand: "#D9CBB6",
        taupe: { DEFAULT: "#9C8B78", dark: "#6F6152" },
        graphite: "#2E2B28",
        ink: "#1B1A18",
        olive: { DEFAULT: "#4B5637", dark: "#3A4329", light: "#E7E9DE" },
        line: "#E4DBCD",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: { brand: "0.42em", label: "0.16em" },
      boxShadow: {
        card: "0 1px 2px rgba(46,43,40,0.04), 0 8px 24px -12px rgba(46,43,40,0.12)",
        lift: "0 2px 4px rgba(46,43,40,0.05), 0 18px 40px -18px rgba(46,43,40,0.28)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
        pop: { "0%": { transform: "scale(1)" }, "50%": { transform: "scale(1.06)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "fade-up": "fade-up .7s cubic-bezier(.2,.7,.2,1) both",
        "fade-in": "fade-in .4s ease both",
        "slide-in": "slide-in .35s cubic-bezier(.2,.7,.2,1) both",
        pop: "pop .35s ease",
      },
    },
  },
  plugins: [],
};

export default config;
