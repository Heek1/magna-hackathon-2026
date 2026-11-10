import { useState } from "react";
import { Lightbulb, MessageSquare, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useChat, useInsights } from "@/api/hooks";
import { ChatPanel } from "@/components/ChatPanel";
import { WhatIfPanel } from "@/components/WhatIfPanel";
import { cn } from "@/lib/utils";
import { InsightFeed } from "./InsightFeed";

type Tab = "insights" | "whatif" | "chat";

/** Right column of Live: insights, What if, and chat (hidden when /api/chat is unavailable). */
export function RightRail({ className }: { className?: string }) {
  const [tab, setTab] = useState<Tab>("insights");
  const { available: chatAvailable } = useChat();
  const insights = useInsights();
  const count = insights.data?.length;

  const tabs: { id: Tab; label: string; icon: LucideIcon; badge?: number }[] = [
    { id: "insights", label: "Insights", icon: Lightbulb, badge: count },
    { id: "whatif", label: "What if", icon: SlidersHorizontal },
    ...(chatAvailable ? [{ id: "chat" as const, label: "Ask", icon: MessageSquare }] : []),
  ];
  const active = tab === "chat" && !chatAvailable ? "insights" : tab;

  return (
    <section className={cn("flex min-h-0 flex-col rounded border bg-surface", className)}>
      <div className="flex h-11 shrink-0 items-stretch border-b px-2" role="tablist">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex items-center gap-2 px-3 text-label font-medium uppercase transition-colors",
              active === id ? "text-text" : "text-muted hover:text-text",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
            {badge !== undefined && <span className="num text-dim">{badge}</span>}
            {active === id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-text" aria-hidden />}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "relative min-h-0 flex-1 p-3",
          active === "insights" && "flex flex-col gap-3 overflow-y-auto",
        )}
        role="tabpanel"
      >
        {active === "insights" && <InsightFeed />}
        {active === "whatif" && <WhatIfPanel />}
        {active === "chat" && <ChatPanel />}
      </div>
    </section>
  );
}
