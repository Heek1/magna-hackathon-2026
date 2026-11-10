import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { fontSize } from "@/theme/tokens";

// Teach tailwind-merge our custom font sizes (text-kpi, text-num-lg, …); otherwise it treats them
// as text colors and drops them when a color class like text-text comes later.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: Object.keys(fontSize) }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
