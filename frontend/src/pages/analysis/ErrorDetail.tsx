import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock, Wrench, ShieldAlert } from "lucide-react";
import { Card } from "./components/Card";
import { Chip, type ChipTone } from "./components/Chip";
import { PatternGrid } from "./components/PatternGrid";
import type { ErrorDetailData } from "./types";
import { cn } from "@/lib/utils";

interface ErrorDetailProps {
  code: string;
  onBack: () => void;
  onActionCreated?: () => void;
}

export function ErrorDetail({ code, onBack, onActionCreated }: ErrorDetailProps) {
  const [data, setData] = useState<ErrorDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionCreated, setActionCreated] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetch(`/api/errors/${code}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ErrorDetailData) => {
        if (alive) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (alive) {
          // Graceful fallback to static data if mock mode
          console.warn("Could not fetch /api/errors/" + code, err);
          setError("Failed to load details for " + code);
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [code]);

  const handleCreateAction = async () => {
    if (!data?.fix || assigning) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.fix.action,
          owner: data.fix.owner_role,
          insight_id: data.code,
        }),
      });
      if (res.ok) {
        setActionCreated(true);
        onActionCreated?.();
      }
    } catch (e) {
      console.error("Failed to create action:", e);
    } finally {
      setAssigning(false);
    }
  };

  const tone: ChipTone =
    data?.kind === "stop" ? "stop" : data?.kind === "defect" ? "defect" : "speed";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[#5F6672]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0E1116] border-t-transparent mb-3" />
        <span className="text-[14px]">Loading error detail for {code}...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[14px] font-medium text-[#5F6672] hover:text-[#0B0D12] mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Top errors
        </button>
        <Card className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-[#E5243B] mx-auto mb-2" />
          <h3 className="text-[16px] font-semibold text-[#0B0D12]">Error Detail Not Available</h3>
          <p className="text-[13px] text-[#5F6672] mt-1">{error || "No data recorded for " + code}</p>
        </Card>
      </div>
    );
  }

  // Format action steps
  const steps = data.fix?.action
    ? data.fix.action.split(/(?<=[.!?])\s+/).filter(Boolean)
    : ["Implement standard countermeasure and inspect root cause."];

  return (
    <div className="flex flex-col pb-24 max-w-xl mx-auto w-full">
      {/* Top Nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-[#5F6672] bg-white border border-[#E6E8EC] hover:text-[#0B0D12] transition-colors shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Top errors</span>
        </button>

        <Chip tone={tone}>
          {data.kind === "stop" ? "Downtime Stop" : data.kind === "defect" ? "Scrap Defect" : "Speed Loss"}
        </Chip>
      </div>

      {/* Title & Description */}
      <div className="mb-5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[28px] font-bold font-mono tracking-tight text-[#0B0D12]">{data.code}</h1>
          {data.device && (
            <span className="text-[13px] font-medium text-[#5F6672] bg-[#F6F7F9] px-2.5 py-0.5 rounded-full">
              Station: {data.device}
            </span>
          )}
        </div>
        <p className="text-[15px] text-[#5F6672] mt-1 leading-snug">{data.description}</p>
      </div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <Card className="p-3 text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#9AA1AD]">Occurrences</div>
          <div className="text-[22px] font-bold font-mono text-[#0B0D12] mt-1">{data.count}</div>
          <div className="text-[11px] text-[#5F6672]">times logged</div>
        </Card>

        <Card className="p-3 text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#9AA1AD]">
            {data.kind === "defect" ? "Scrapped" : "Duration"}
          </div>
          <div className="text-[22px] font-bold font-mono text-[#0B0D12] mt-1">
            {data.kind === "defect"
              ? `${data.loss_pcs.toFixed(0)} pcs`
              : `${data.minutes.toFixed(0)} min`}
          </div>
          <div className="text-[11px] text-[#5F6672]">
            {data.kind === "defect" ? "NOK parts" : "total downtime"}
          </div>
        </Card>

        <Card className="p-3 text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#9AA1AD]">Loss Impact</div>
          <div className="text-[22px] font-bold font-mono text-[#E5243B] mt-1">
            {data.loss_pcs.toFixed(0)} <span className="text-[13px] font-normal">pcs</span>
          </div>
          <div className="text-[11px] font-mono text-[#9AA1AD]">-{data.loss_pp.toFixed(1)} pp OEE</div>
        </Card>
      </div>

      {/* When It Happens (Pattern Grid) */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#5F6672]" />
            <h2 className="text-[15px] font-semibold text-[#0B0D12]">When it happens</h2>
          </div>
          <span className="text-[12px] text-[#9AA1AD]">Mon–Fri · 06–13h</span>
        </div>

        <PatternGrid pattern={data.pattern} tone={tone} />

        {/* Pattern Note / Next expected alert */}
        {data.next_expected && (
          <div className="mt-4 flex items-start gap-2.5 rounded-[14px] bg-[#FDECEE] p-3 text-[13px] text-[#E5243B] border border-[#E5243B]/20">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Recurring Pattern Detected:</span> occurs every Wednesday in shift hour 4.
              <div className="text-[12px] opacity-90 mt-0.5">
                Next expected stop: <span className="font-mono font-bold">{new Date(data.next_expected).toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Solution Card */}
      {data.fix && (
        <Card className="p-4 mb-4 border-[#0E9F6E]/30 bg-gradient-to-b from-[#E7F6EF]/30 to-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[#0E9F6E]" />
              <h2 className="text-[15px] font-semibold text-[#0B0D12]">Standardized Countermeasure</h2>
            </div>
            <Chip tone="fix">+{data.gain_pp.toFixed(1)} pp Gain</Chip>
          </div>

          <div className="flex items-center gap-2 my-2 flex-wrap">
            <Chip tone="fix" dot={false} className="font-semibold">
              Method: {data.fix.method}
            </Chip>
            <span className="text-[12px] font-medium text-[#5F6672] bg-white px-2.5 py-1 rounded-full border border-[#E6E8EC]">
              Owner: {data.fix.owner_role}
            </span>
          </div>

          {/* Numbered Steps */}
          <div className="mt-3 flex flex-col gap-2">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-[14px] text-[#0B0D12]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0E9F6E] text-[11px] font-bold text-white mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-md border-t border-[#E6E8EC] z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="text-[12px] text-[#5F6672] hidden sm:block">
            Expected Gain: <span className="font-mono font-bold text-[#0E9F6E]">+{data.loss_pcs.toFixed(0)} pcs</span>
          </div>

          <button
            type="button"
            disabled={actionCreated || assigning}
            onClick={handleCreateAction}
            className={cn(
              "flex-1 sm:flex-initial sm:px-6 h-12 flex items-center justify-center gap-2 rounded-[18px] text-[15px] font-semibold transition-all shadow-md",
              actionCreated
                ? "bg-[#E7F6EF] text-[#0E9F6E] border border-[#0E9F6E]/40"
                : "bg-[#0E1116] text-white hover:bg-[#1E232D] active:scale-[0.98]",
            )}
          >
            {actionCreated ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Action Assigned to {data.fix?.owner_role || "Team"}
              </>
            ) : assigning ? (
              "Assigning..."
            ) : (
              `Create Action for ${data.fix?.owner_role || "Maintenance"}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
