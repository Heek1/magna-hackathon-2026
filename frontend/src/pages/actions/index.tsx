import { useState, useMemo } from "react";
import { Plus, ArrowRight, Check, RotateCcw, User, Tag, TrendingUp, X } from "lucide-react";
import { useActions, useInsights } from "@/api/hooks";
import type { ActionStatus, ActionCreate } from "@/types/api";
import { cn } from "@/lib/utils";

const ROLES = ["Maintenance", "Quality", "Logistics", "Team leader", "Process engineer"] as const;

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  Maintenance: { bg: "bg-[#EAF0FF]", text: "text-[#2F6BFF]" },
  Quality: { bg: "bg-[#FFF4E5]", text: "text-[#F08A00]" },
  "Process engineer": { bg: "bg-[#F3E8FF]", text: "text-[#7E22CE]" },
  "Team leader": { bg: "bg-[#E7F6EF]", text: "text-[#0E9F6E]" },
  Logistics: { bg: "bg-[#F6F7F9]", text: "text-[#5F6672]" },
};

export default function ActionsPage() {
  const { data: actions = [], updateStatus, createAction } = useActions();
  const { data: insights = [] } = useInsights();

  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [mobileStatus, setMobileStatus] = useState<ActionStatus>("open");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<string>("Maintenance");
  const [insightId, setInsightId] = useState<string>("");

  // Helper to map insight ID to expected gain
  const insightMap = useMemo(() => {
    const map = new Map<string, { title: string; gain_pcs: number }>();
    insights.forEach((i) => {
      map.set(i.id, {
        title: i.title,
        gain_pcs: i.recommendation?.expected_gain_pcs ?? i.loss_pcs ?? 0,
      });
      if (i.code) {
        map.set(i.code, {
          title: i.title,
          gain_pcs: i.recommendation?.expected_gain_pcs ?? i.loss_pcs ?? 0,
        });
      }
    });
    return map;
  }, [insights]);

  // Handle Create Action
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const actionPayload: ActionCreate = {
      title: title.trim(),
      owner: owner,
      insight_id: insightId || null,
      status: "open",
    };

    // If createAction supports ActionCreate or Insight
    try {
      await createAction(actionPayload as any);
    } catch {
      // Direct REST fallback
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionPayload),
      });
    }

    setTitle("");
    setInsightId("");
    setIsModalOpen(false);
  };

  // Quick DnD handlers
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", String(id));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ActionStatus) => {
    e.preventDefault();
    if (draggedId !== null) {
      updateStatus(draggedId, targetStatus);
      setDraggedId(null);
    }
  };

  // Filter actions
  const filteredActions = useMemo(() => {
    if (filterOwner === "all") return actions;
    return actions.filter((a) => a.owner === filterOwner);
  }, [actions, filterOwner]);

  const columns: { status: ActionStatus; label: string; toneBg: string; toneText: string }[] = [
    { status: "open", label: "Open", toneBg: "bg-[#FDECEE]", toneText: "text-[#E5243B]" },
    { status: "in_progress", label: "In Progress", toneBg: "bg-[#EAF0FF]", toneText: "text-[#2F6BFF]" },
    { status: "done", label: "Done", toneBg: "bg-[#E7F6EF]", toneText: "text-[#0E9F6E]" },
  ];

  const countByStatus = {
    open: filteredActions.filter((a) => a.status === "open").length,
    in_progress: filteredActions.filter((a) => a.status === "in_progress").length,
    done: filteredActions.filter((a) => a.status === "done").length,
  };

  // Render individual action card
  const renderCard = (action: (typeof actions)[0]) => {
    const meta = action.insight_id ? insightMap.get(action.insight_id) : undefined;
    const gain = meta ? Math.round(Number(meta.gain_pcs) || 0) : 0;
    const roleColor = (action.owner && ROLE_COLORS[action.owner]) || {
      bg: "bg-[#F6F7F9]",
      text: "text-[#5F6672]",
    };

    return (
      <div
        key={action.id}
        draggable
        onDragStart={(e) => handleDragStart(e, action.id)}
        className="rounded-[18px] bg-white p-4 border border-[#E6E8EC]/80 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.06)] hover:border-[#D5D9E0] transition-all cursor-grab active:cursor-grabbing flex flex-col gap-2.5"
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-[14px] font-semibold text-[#0B0D12] leading-snug flex-1">
            {action.title}
          </h4>
          <span className="text-[11px] font-mono text-[#9AA1AD] shrink-0">#{action.id}</span>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {action.owner && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium",
                roleColor.bg,
                roleColor.text,
              )}
            >
              <User className="h-3 w-3" />
              {action.owner}
            </span>
          )}

          {action.insight_id && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#F6F7F9] text-[#5F6672]">
              <Tag className="h-3 w-3" />
              {action.insight_id}
            </span>
          )}

          {gain > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E7F6EF] text-[#0E9F6E]">
              <TrendingUp className="h-3 w-3" />+{gain} pcs gain
            </span>
          )}
        </div>

        {/* Quick status transition buttons */}
        <div className="mt-1 pt-2 border-t border-[#E6E8EC]/60 flex items-center justify-between text-[11px] text-[#9AA1AD]">
          <span>
            {new Date(action.created_at).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          <div className="flex items-center gap-1">
            {action.status === "open" && (
              <button
                type="button"
                onClick={() => updateStatus(action.id, "in_progress")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F6F7F9] text-[#0B0D12] hover:bg-[#EAF0FF] hover:text-[#2F6BFF] transition-colors"
              >
                <span>Start</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}

            {action.status === "in_progress" && (
              <>
                <button
                  type="button"
                  onClick={() => updateStatus(action.id, "open")}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-[#5F6672] hover:bg-[#F6F7F9]"
                  title="Move back to open"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(action.id, "done")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E7F6EF] text-[#0E9F6E] hover:bg-[#0E9F6E] hover:text-white transition-colors"
                >
                  <Check className="h-3 w-3" />
                  <span>Done</span>
                </button>
              </>
            )}

            {action.status === "done" && (
              <button
                type="button"
                onClick={() => updateStatus(action.id, "in_progress")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-[#5F6672] hover:bg-[#F6F7F9] transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reopen</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F3F4F7] px-4 py-5 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-4 pb-20">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9AA1AD]">
              STANDARDIZED WORK · LEAN COUNTERMEASURES
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0B0D12] mt-0.5">
              Action Board
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="h-10 px-4 rounded-[18px] bg-[#0E1116] text-white hover:bg-[#1E232D] text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Action</span>
          </button>
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[13px]">
          <button
            type="button"
            onClick={() => setFilterOwner("all")}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap",
              filterOwner === "all"
                ? "bg-[#0E1116] text-white shadow-xs"
                : "bg-white text-[#5F6672] hover:text-[#0B0D12] border border-[#E6E8EC]",
            )}
          >
            All Roles ({actions.length})
          </button>
          {ROLES.map((role) => {
            const count = actions.filter((a) => a.owner === role).length;
            const active = filterOwner === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setFilterOwner(role)}
                className={cn(
                  "px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap flex items-center gap-1.5",
                  active
                    ? "bg-[#0E1116] text-white shadow-xs"
                    : "bg-white text-[#5F6672] hover:text-[#0B0D12] border border-[#E6E8EC]",
                )}
              >
                <span>{role}</span>
                <span className={cn("text-[11px] font-mono", active ? "text-white/80" : "text-[#9AA1AD]")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile View: Segmented switcher (< 1024px) */}
        <div className="lg:hidden flex flex-col gap-3">
          <div className="flex w-full items-center rounded-[16px] bg-[#F6F7F9] p-1 border border-[#E6E8EC]/60">
            {columns.map((col) => {
              const active = mobileStatus === col.status;
              return (
                <button
                  key={col.status}
                  type="button"
                  onClick={() => setMobileStatus(col.status)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] transition-all rounded-[12px]",
                    active
                      ? "bg-white text-[#0B0D12] font-semibold shadow-[0_1px_3px_rgba(16,24,40,0.08)]"
                      : "text-[#5F6672] font-medium hover:text-[#0B0D12]",
                  )}
                >
                  <span>{col.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[11px] font-mono",
                      active ? "bg-[#F3F4F7] text-[#0B0D12]" : "bg-transparent text-[#9AA1AD]",
                    )}
                  >
                    {countByStatus[col.status]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Card list for the active status */}
          <div className="flex flex-col gap-2.5">
            {filteredActions.filter((a) => a.status === mobileStatus).map(renderCard)}

            {countByStatus[mobileStatus] === 0 && (
              <div className="rounded-[22px] bg-white p-8 text-center text-[#5F6672] text-[13px] border border-[#E6E8EC]">
                No actions in {mobileStatus.replace("_", " ")}
              </div>
            )}
          </div>
        </div>

        {/* Desktop View: 3-column Kanban (≥ 1024px) */}
        <div className="hidden lg:grid grid-cols-3 gap-4 items-start">
          {columns.map((col) => {
            const colActions = filteredActions.filter((a) => a.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.status)}
                className="flex flex-col rounded-[22px] bg-[#F6F7F9]/70 p-3 border border-[#E6E8EC] min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-6 px-2 items-center justify-center rounded-full text-[11px] font-bold font-mono",
                        col.toneBg,
                        col.toneText,
                      )}
                    >
                      {colActions.length}
                    </span>
                    <h3 className="text-[14px] font-semibold text-[#0B0D12]">{col.label}</h3>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex flex-col gap-2.5 flex-1">
                  {colActions.map(renderCard)}

                  {colActions.length === 0 && (
                    <div className="flex-1 flex items-center justify-center rounded-[18px] border-2 border-dashed border-[#E6E8EC] p-6 text-center text-[12px] text-[#9AA1AD]">
                      Drag tasks here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Action Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[22px] bg-white p-6 shadow-xl border border-[#E6E8EC] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-[#0B0D12]">Create New Action</h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-1 text-[#9AA1AD] hover:text-[#0B0D12]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#5F6672] mb-1">
                    Action Title / Task
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Inspect and calibrate camera light module"
                    className="w-full rounded-[14px] border border-[#E6E8EC] bg-[#F6F7F9] px-3.5 py-2.5 text-[14px] text-[#0B0D12] placeholder:text-[#9AA1AD] focus:bg-white focus:border-[#0E1116] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#5F6672] mb-1">
                    Responsible Role
                  </label>
                  <select
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className="w-full rounded-[14px] border border-[#E6E8EC] bg-[#F6F7F9] px-3.5 py-2.5 text-[14px] text-[#0B0D12] focus:bg-white focus:border-[#0E1116] focus:outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#5F6672] mb-1">
                    Linked Error / Root Cause (Optional)
                  </label>
                  <input
                    type="text"
                    value={insightId}
                    onChange={(e) => setInsightId(e.target.value)}
                    placeholder="e.g. ST-038 or Q-031"
                    className="w-full rounded-[14px] border border-[#E6E8EC] bg-[#F6F7F9] px-3.5 py-2.5 text-[14px] text-[#0B0D12] placeholder:text-[#9AA1AD] focus:bg-white focus:border-[#0E1116] focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[#E6E8EC]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-10 px-4 rounded-[14px] text-[13px] font-medium text-[#5F6672] hover:text-[#0B0D12]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-5 rounded-[14px] bg-[#0E1116] text-white hover:bg-[#1E232D] text-[13px] font-semibold transition-all shadow-sm"
                  >
                    Create Action
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
