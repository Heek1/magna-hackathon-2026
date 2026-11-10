import type { Config } from "tailwindcss";
import { colors, fonts, fontSize, radius, motion } from "./src/theme/tokens";

export default {
  content: { relative: true, files: ["./index.html", "./src/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors,
      fontFamily: fonts,
      fontSize: fontSize as unknown as Record<string, [string, Record<string, string>]>,
      borderRadius: { DEFAULT: radius, sm: "2px", md: radius },
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
