import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { fonts, fontSize, motion, radius, shadow, spacing, tailwindColors, themeVars } from "./src/theme/tokens";

export default {
  // Hover only where a real pointer exists, so taps on phones do not leave buttons stuck highlighted.
  future: { hoverOnlyWhenSupported: true },
  content: { relative: true, files: ["./index.html", "./src/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors: tailwindColors,
      fontFamily: fonts,
      fontSize,
      borderRadius: { DEFAULT: radius.badge, ...radius },
      boxShadow: shadow,
      spacing,
      keyframes: {
        pulse: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: {
        "stop-pulse": `pulse ${motion.pulse}s ease-in-out infinite`,
      },
    },
  },
  plugins: [
    // Theme colors as CSS variables; <html data-theme="dark"> switches them.
    plugin(({ addBase }) => {
      addBase({ ":root": themeVars("light"), '[data-theme="dark"]': themeVars("dark") });
    }),
  ],
} satisfies Config;
