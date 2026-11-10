import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "stop" | "defect" | "speed" | "fix" | "neutral";

interface ChipProps {
  tone?: ChipTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const toneStyles: Record<ChipTone, { bg: string; text: string; dot: string }> = {
  stop: {
    bg: "bg-[#FDECEE]",
    text: "text-[#E5243B]",
    dot: "bg-[#E5243B]",
  },
  defect: {
    bg: "bg-[#FFF4E5]",
    text: "text-[#F08A00]",
    dot: "bg-[#F08A00]",
  },
  speed: {
    bg: "bg-[#EAF0FF]",
    text: "text-[#2F6BFF]",
    dot: "bg-[#2F6BFF]",
  },
  fix: {
    bg: "bg-[#E7F6EF]",
    text: "text-[#0E9F6E]",
    dot: "bg-[#0E9F6E]",
  },
  neutral: {
    bg: "bg-[#F6F7F9]",
    text: "text-[#5F6672]",
    dot: "bg-[#9AA1AD]",
  },
};

export function Chip({ tone = "neutral", dot = true, children, className }: ChipProps) {
  const t = toneStyles[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none whitespace-nowrap",
        t.bg,
        t.text,
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", t.dot)} />}
      <span>{children}</span>
    </span>
  );
}
