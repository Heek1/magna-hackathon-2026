import type { ErrorPatternCell } from "../types";
import type { ChipTone } from "./Chip";
import { cn } from "@/lib/utils";

interface PatternGridProps {
  pattern: ErrorPatternCell[];
  tone?: ChipTone;
  className?: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13];

const cellActiveColors: Record<ChipTone, { bg: string; text: string; border: string }> = {
  stop: {
    bg: "bg-[#FDECEE]",
    text: "text-[#E5243B]",
    border: "border-[#E5243B]/40",
  },
  defect: {
    bg: "bg-[#FFF4E5]",
    text: "text-[#F08A00]",
    border: "border-[#F08A00]/40",
  },
  speed: {
    bg: "bg-[#EAF0FF]",
    text: "text-[#2F6BFF]",
    border: "border-[#2F6BFF]/40",
  },
  fix: {
    bg: "bg-[#E7F6EF]",
    text: "text-[#0E9F6E]",
    border: "border-[#0E9F6E]/40",
  },
  neutral: {
    bg: "bg-[#E6E8EC]",
    text: "text-[#0B0D12]",
    border: "border-[#5F6672]",
  },
};

export function PatternGrid({ pattern = [], tone = "stop", className }: PatternGridProps) {
  // Build lookup map: "Mon-9" -> count
  const countMap = new Map<string, number>();
  for (const item of pattern) {
    const key = `${item.weekday}-${item.hour}`;
    countMap.set(key, (countMap.get(key) || 0) + item.count);
  }

  const activeColor = cellActiveColors[tone];

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="min-w-[340px]">
        {/* Hours Header */}
        <div className="grid grid-cols-9 gap-1.5 mb-1.5 text-center">
          <div className="text-[11px] font-medium text-[#9AA1AD] text-left">Day</div>
          {HOURS.map((h) => (
            <div key={h} className="text-[11px] font-mono text-[#9AA1AD]">
              {String(h).padStart(2, "0")}h
            </div>
          ))}
        </div>

        {/* Rows for each weekday */}
        <div className="flex flex-col gap-1.5">
          {WEEKDAYS.map((day) => (
            <div key={day} className="grid grid-cols-9 gap-1.5 items-center">
              <span className="text-[12px] font-medium text-[#5F6672]">{day}</span>
              {HOURS.map((h) => {
                const count = countMap.get(`${day}-${h}`) || 0;
                const isHot = count > 0;
                return (
                  <div
                    key={`${day}-${h}`}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-[8px] text-[12px] font-mono transition-all",
                      isHot
                        ? cn("font-bold border shadow-xs", activeColor.bg, activeColor.text, activeColor.border)
                        : "bg-[#F6F7F9] text-[#9AA1AD]/40",
                    )}
                    title={isHot ? `${day} hour ${h}:00 — ${count} times` : `${day} hour ${h}:00 — 0`}
                  >
                    {isHot ? count : "·"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
