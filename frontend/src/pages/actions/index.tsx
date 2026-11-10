import { useState, useMemo } from "react";
import { Plus, ArrowRight, Check, RotateCcw, User, Tag } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useActions, useInsights } from "@/api/hooks";
import type { ActionStatus } from "@/types/api";

const ROLES = ["Maintenance", "Quality", "Logistics", "Team leader", "Process engineer"] as const;

export default function ActionsPage() {
  const { data: actions = [], updateStatus, createAction } = useActions();
  const { data: insights = [] } = useInsights();

  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<string>("Maintenance");
  const [insightId, setInsightId] = useState<string>("");

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

  // Helper to map insight ID to expected gain
  const insightMap = useMemo(() => {
    const map = new Map<string, { title: string; gain_pcs: number }>();
    insights.forEach((ins) => {
      map.set(ins.id, {
        title: ins.title,
        gain_pcs: ins.recommendation?.expected_gain_pcs ?? Math.round(ins.loss_pcs * 0.8) ?? 10,
      });
    });
    return map;
  }, [insights]);

  // Handle Create Action
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Use createAction or local dispatch
    const linked = insights.find((i) => i.id === insightId);
    if (linked) {
      await createAction(linked);
    } else {
      // Direct action creation fallback
      await createAction({
        id: insightId || `action-${Date.now()}`,
        kind: "recurring_stop",
        severity: "medium",
        title: title.trim(),
        evidence: "Manual user action created from board",
        code: null,
        loss_pcs: 20,
        loss_pp: 0.2,
        expected_at: null,
        recommendation: {
          action: title.trim(),
          method: "Standard work",
          owner_role: owner,
          expected_gain_pcs: 20,
        },
      });
    }

    setTitle("");
    setIsModalOpen(false);
  };

  const filteredActions = useMemo(() => {
    return actions.filter((act) => {
      if (filterOwner !== "all" && act.owner !== filterOwner) return false;
      return true;
    });
  }, [actions, filterOwner]);

  const columns: { status: ActionStatus; label: string; badgeStatus: "crit" | "warn" | "ok" }[] = [
    { status: "open", label: "Open", badgeStatus: "crit" },
    { status: "in_progress", label: "In Progress", badgeStatus: "warn" },
    { status: "done", label: "Done", badgeStatus: "ok" },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 min-h-0 h-full overflow-y-auto">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-surface p-3">
        <div className="flex items-center gap-3">
          <span className="label text-muted">Role Filter:</span>
          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="bg-bg border border-border text-text rounded px-2.5 py-1 text-xs font-mono outline-none"
          >
            <option value="all">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <Button
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5 font-mono text-xs uppercase"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Action
        </Button>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-[540px]">
        {columns.map((col) => {
          const items = filteredActions.filter((a) => a.status === col.status);
          const totalPcs = items.reduce((sum: number, item) => {
            const gain = Number((item.insight_id && insightMap.get(item.insight_id)?.gain_pcs) ?? 15);
            return sum + gain;
          }, 0);

          return (
            <div
              key={col.status}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
              className="flex flex-col rounded border border-border bg-surface p-3 min-h-0"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={col.badgeStatus}>{col.label}</StatusBadge>
                  <span className="label text-dim">({items.length})</span>
                </div>
                <span className="font-mono text-xs text-ok font-semibold">
                  +{totalPcs} pcs
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="h-32 border border-dashed border-border rounded flex items-center justify-center text-xs font-mono text-dim">
                    Drop items here
                  </div>
                ) : (
                  items.map((act) => {
                    const gain = (act.insight_id && insightMap.get(act.insight_id)?.gain_pcs) ?? 15;

                    return (
                      <div
                        key={act.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, act.id)}
                        className="rounded border border-border bg-bg p-3 shadow-none hover:border-border-strong cursor-grab active:cursor-grabbing transition-colors space-y-2"
                      >
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 text-[11px] font-mono text-muted truncate max-w-[170px]">
                            <Tag className="h-3 w-3 shrink-0 text-dim" />
                            {act.insight_id ?? "General"}
                          </span>
                          <span className="font-mono text-xs font-bold text-ok px-1.5 py-0.5 rounded border border-ok/30 bg-ok/10 shrink-0">
                            +{gain} pcs
                          </span>
                        </div>

                        {/* Title */}
                        <p className="text-xs font-medium text-text leading-snug">
                          {act.title}
                        </p>

                        {/* Footer: Owner and Date */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] font-mono text-dim">
                          <span className="flex items-center gap-1 text-muted">
                            <User className="h-3 w-3 text-dim" />
                            {act.owner ?? "Unassigned"}
                          </span>
                          <span>{act.created_at ? act.created_at.slice(0, 10) : "Today"}</span>
                        </div>

                        {/* Status Change Buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          {col.status === "open" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateStatus(act.id, "in_progress")}
                              className="h-6 text-[11px] px-2 font-mono gap-1 text-warn border border-warn/40 hover:bg-warn/10"
                            >
                              Start <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                          {col.status === "in_progress" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateStatus(act.id, "open")}
                                className="h-6 text-[11px] px-2 font-mono text-dim hover:text-text border border-border"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateStatus(act.id, "done")}
                                className="h-6 text-[11px] px-2 font-mono gap-1 text-ok border border-ok/40 hover:bg-ok/10"
                              >
                                <Check className="h-3 w-3" /> Done
                              </Button>
                            </>
                          )}
                          {col.status === "done" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus(act.id, "in_progress")}
                              className="h-6 text-[11px] px-2 font-mono text-dim hover:text-text border border-border"
                            >
                              <RotateCcw className="h-3 w-3" /> Reopen
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Action Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h2 className="label text-text font-bold">New Continuous Improvement Action</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-dim hover:text-text text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-label uppercase text-muted mb-1">Action Description</label>
                <textarea
                  required
                  rows={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Inspect and clean camera optical illuminator during autonomous maintenance..."
                  className="w-full rounded border border-border bg-bg p-2 text-xs font-mono text-text outline-none focus:border-border-strong"
                />
              </div>

              <div>
                <label className="block text-label uppercase text-muted mb-1">Owner Role</label>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full rounded border border-border bg-bg p-2 text-xs font-mono text-text outline-none focus:border-border-strong"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-label uppercase text-muted mb-1">Linked Insight / Root Cause</label>
                <select
                  value={insightId}
                  onChange={(e) => setInsightId(e.target.value)}
                  className="w-full rounded border border-border bg-bg p-2 text-xs font-mono text-text outline-none focus:border-border-strong"
                >
                  <option value="">Manual / General</option>
                  {insights.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.title} (+{ins.recommendation?.expected_gain_pcs ?? Math.round(ins.loss_pcs * 0.8)} pcs)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="font-mono text-xs border border-border"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="font-mono text-xs">
                  Save Action
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
