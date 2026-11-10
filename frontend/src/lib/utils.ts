import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { fontSize, radius, shadow, spacing } from "@/theme/tokens";

// Teach tailwind-merge our token names (text-num-l, rounded-card, shadow-card, p-card-pad, …);
// otherwise it misreads them (a font size as a text color) and drops or keeps the wrong class.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: Object.keys(spacing) },
    classGroups: {
      "font-size": [{ text: Object.keys(fontSize) }],
      rounded: [{ rounded: Object.keys(radius) }],
      shadow: [{ shadow: Object.keys(shadow) }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
