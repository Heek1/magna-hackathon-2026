import { useState, useMemo } from "react";
import { useLosses } from "@/api/hooks";
import { Card } from "./components/Card";
import { Chip } from "./components/Chip";
import { SegmentedControl } from "./components/SegmentedControl";
import { RankRow } from "./components/RankRow";
import { ErrorDetail } from "./ErrorDetail";
import type { LossWithFix } from "./types";
import { Wrench, CheckCircle2, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type ErrorCategory = "stops" | "defects" | "speed";

export default function AnalysisPage() {
  const [category, setCategory] = useState<ErrorCategory>("stops");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [assignedCodes, setAssignedCodes] = useState<Set<string>>(new Set());

  // Fetch losses from API / hooks
  const { data: rawLosses = [], loading } = useLosses({ from: "2026-11-01", to: "2026-11-30" });
  const losses = rawLosses as LossWithFix[];

  // Filter losses by category
  const categorized = useMemo(() => {
    const stops = losses.filter((l) => l.type === "downtime");
    const defects = losses.filter((l) => l.type === "nok");
    const speed = losses.filter((l) => l.type === "microstop" || l.type === "retest" || l.type === "slowdown");

    // Sort by pieces lost descending
    const sorter = (a: LossWithFix, b: LossWithFix) => b.loss_pcs - a.loss_pcs;
    return {
      stops: [...stops].sort(sorter),
      defects: [...defects].sort(sorter),
      speed: [...speed].sort(sorter),
    };
  }, [losses]);

  const currentList = categorized[category];
  const firstItem = currentList[0] || null;
  const restItems = currentList.slice(1);

  // Category counts
  const categoryOptions = [
    { value: "stops" as const, label: "Stops", count: categorized.stops.length },
    { value: "defects" as const, label: "Defects", count: categorized.defects.length },
    { value: "speed" as const, label: "Speed", count: categorized.speed.length },
  ];

  // Assign action handler
  const handleAssignAction = async (item: LossWithFix, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.fix || assignedCodes.has(item.code)) return;

    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.fix.action,
          owner: item.fix.owner_role,
          insight_id: item.code,
        }),
      });
      if (res.ok) {
        setAssignedCodes((prev) => new Set(prev).add(item.code));
      }
    } catch (err) {
      console.error("Failed to assign action:", err);
    }
  };

  const getTone = (cat: ErrorCategory) => {
    if (cat === "stops") return "stop";
    if (cat === "defects") return "defect";
    return "speed";
  };

  // If mobile and error is selected -> show full screen ErrorDetail
  if (selectedCode) {
    return (
      <div className="min-h-screen bg-[#F3F4F7] px-4 py-5 sm:px-6">
        <ErrorDetail
          code={selectedCode}
          onBack={() => setSelectedCode(null)}
          onActionCreated={() => {
            setAssignedCodes((prev) => new Set(prev).add(selectedCode));
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F7] px-4 py-5 sm:px-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-20">
        {/* Header */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9AA1AD]">
            NOVEMBER · BY PIECES LOST
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#0B0D12] mt-0.5">Top errors</h1>
        </div>

        {/* Segmented Control */}
        <SegmentedControl options={categoryOptions} value={category} onChange={setCategory} />

        {loading && (
          <div className="p-8 text-center text-[#5F6672] text-[14px]">Loading loss data...</div>
        )}

        {!loading && currentList.length === 0 && (
          <Card className="p-8 text-center text-[#5F6672]">
            <p className="text-[14px]">No errors recorded in this category.</p>
          </Card>
        )}

        {/* #1 Fix First Hero Card */}
        {firstItem && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#E5243B] flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-[#E5243B] animate-pulse" />
                #1 To Fix First
              </span>
              <span className="text-[12px] font-medium text-[#5F6672]">
                Accounts for {firstItem.loss_pp.toFixed(1)} pp of total losses
              </span>
            </div>

            <Card
              onClick={() => setSelectedCode(firstItem.code)}
              className="border-[#E5243B]/20 shadow-[0_4px_16px_rgba(229,36,59,0.06)] hover:border-[#E5243B]/40 transition-all p-4 sm:p-5"
            >
              {/* Pattern Chip & Meta */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <Chip tone="stop" className="font-semibold">
                  {firstItem.code === "ST-038"
                    ? "Pattern: Every Wed 09:08"
                    : firstItem.code === "ST-047"
                      ? "Pattern: Every Thu 08:08"
                      : "Priority #1 Impact"}
                </Chip>
                {firstItem.device && (
                  <span className="text-[12px] font-medium text-[#5F6672] bg-[#F6F7F9] px-2.5 py-0.5 rounded-full">
                    Station: {firstItem.device}
                  </span>
                )}
              </div>

              {/* Title & Loss */}
              <div className="flex items-start justify-between gap-3 my-2">
                <div>
                  <h3 className="font-mono text-[18px] font-bold text-[#0B0D12]">{firstItem.code}</h3>
                  <p className="text-[14px] text-[#5F6672] leading-snug mt-0.5">{firstItem.description}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-[26px] font-bold text-[#E5243B] leading-none">
                    {firstItem.loss_pcs.toFixed(0)}{" "}
                    <span className="text-[13px] font-normal text-[#5F6672]">pcs</span>
                  </div>
                  <div className="text-[11px] font-mono text-[#9AA1AD] mt-1">
                    -{firstItem.loss_pp.toFixed(1)} pp OEE
                  </div>
                </div>
              </div>

              {/* Green Solution Block */}
              {firstItem.fix ? (
                <div className="mt-4 rounded-[16px] bg-[#E7F6EF] p-3.5 border border-[#0E9F6E]/20">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[12px] font-semibold text-[#0E9F6E] flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      Recommended Fix
                    </span>
                    <Chip tone="fix" dot={false} className="py-0.5 px-2 text-[11px] bg-white font-semibold">
                      +{firstItem.loss_pcs.toFixed(0)} pcs gain
                    </Chip>
                  </div>

                  <p className="text-[13px] text-[#0B0D12] leading-snug">{firstItem.fix.action}</p>

                  <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-[#0E9F6E]/20">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-medium text-[#0E9F6E] bg-white/80 px-2 py-0.5 rounded-md">
                        {firstItem.fix.method}
                      </span>
                      <span className="text-[11px] font-medium text-[#5F6672] bg-white/80 px-2 py-0.5 rounded-md">
                        Owner: {firstItem.fix.owner_role}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleAssignAction(firstItem, e)}
                      className={cn(
                        "h-8 px-3.5 rounded-[12px] text-[12px] font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0",
                        assignedCodes.has(firstItem.code)
                          ? "bg-white text-[#0E9F6E] border border-[#0E9F6E]/40"
                          : "bg-[#0E1116] text-white hover:bg-[#1E232D] active:scale-95",
                      )}
                    >
                      {assignedCodes.has(firstItem.code) ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Assigned
                        </>
                      ) : (
                        "Assign"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedCode(firstItem.code)}
                    className="text-[13px] font-medium text-[#2F6BFF] flex items-center gap-1"
                  >
                    View details <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Next to Fix List */}
        {restItems.length > 0 && (
          <div className="flex flex-col gap-2.5 mt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[13px] font-semibold text-[#0B0D12] flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-[#5F6672]" />
                Next to fix ({restItems.length})
              </span>
              <span className="text-[11px] text-[#9AA1AD]">Tap for root cause & fix</span>
            </div>

            <div className="flex flex-col gap-2">
              {restItems.map((item, index) => (
                <RankRow
                  key={item.code}
                  rank={index + 2}
                  code={item.code}
                  description={item.description}
                  device={item.device}
                  count={item.count}
                  lossPcs={item.loss_pcs}
                  lossPp={item.loss_pp}
                  maxLossPcs={firstItem?.loss_pcs || 100}
                  tone={getTone(category)}
                  fixMethod={item.fix?.method}
                  fixOwner={item.fix?.owner_role}
                  onClick={() => setSelectedCode(item.code)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
