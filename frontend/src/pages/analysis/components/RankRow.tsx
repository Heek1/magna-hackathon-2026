import { ChevronRight } from "lucide-react";
import { Chip, type ChipTone } from "./Chip";
import { cn } from "@/lib/utils";

interface RankRowProps {
  rank: number;
  code: string;
  description: string;
  device?: string | null;
  count: number;
  lossPcs: number;
  lossPp: number;
  maxLossPcs: number;
  tone?: ChipTone;
  fixMethod?: string | null;
  fixOwner?: string | null;
  onClick?: () => void;
  className?: string;
}

const barColors: Record<ChipTone, string> = {
  stop: "bg-[#E5243B]",
  defect: "bg-[#F08A00]",
  speed: "bg-[#2F6BFF]",
  fix: "bg-[#0E9F6E]",
  neutral: "bg-[#5F6672]",
};

export function RankRow({
  rank,
  code,
  description,
  device,
  count,
  lossPcs,
  lossPp,
  maxLossPcs,
  tone = "stop",
  fixMethod,
  fixOwner,
  onClick,
  className,
}: RankRowProps) {
  const percent = maxLossPcs > 0 ? Math.min(100, Math.max(4, (lossPcs / maxLossPcs) * 100)) : 0;
  const barColor = barColors[tone];

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-2 rounded-[18px] bg-white p-3.5 border border-[#E6E8EC]/70 shadow-[0_1px_2px_rgba(16,24,40,0.03)] hover:border-[#D5D9E0] transition-all cursor-pointer active:scale-[0.995]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Rank + Info */}
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[#F6F7F9] text-[12px] font-bold font-mono text-[#5F6672]">
            #{rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-[14px] text-[#0B0D12]">{code}</span>
              {device && (
                <span className="text-[11px] font-medium text-[#5F6672] bg-[#F6F7F9] px-2 py-0.5 rounded-full">
                  {device}
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#5F6672] truncate mt-0.5">{description}</p>
          </div>
        </div>

        {/* Right: Loss number + arrow */}
        <div className="flex items-center gap-2 shrink-0 text-right">
          <div>
            <div className="font-mono font-semibold text-[14px] text-[#0B0D12]">
              {lossPcs.toLocaleString("en-US", { maximumFractionDigits: 1 })}{" "}
              <span className="text-[11px] font-normal text-[#5F6672]">pcs lost</span>
            </div>
            <div className="text-[11px] font-mono text-[#9AA1AD]">
              {lossPp > 0 ? `-${lossPp.toFixed(1)} pp` : `${count} times`}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#9AA1AD] group-hover:text-[#0B0D12] transition-colors shrink-0" />
        </div>
      </div>

      {/* Progress Bar + Solution Tag */}
      <div className="flex items-center gap-3 mt-1">
        <div className="relative h-1.5 flex-1 rounded-full bg-[#F6F7F9] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${percent}%` }}
          />
        </div>

        {fixMethod && (
          <Chip tone="fix" dot={false} className="py-0.5 px-2 text-[11px] shrink-0">
            {fixMethod} {fixOwner ? `· ${fixOwner}` : ""}
          </Chip>
        )}
      </div>
    </div>
  );
}
