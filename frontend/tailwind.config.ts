import type { Config } from "tailwindcss";
import { fonts, fontSize, motion, radius, shadow, spacing, tailwindColors } from "./src/theme/tokens";

export default {
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
  plugins: [],
} satisfies Config;
