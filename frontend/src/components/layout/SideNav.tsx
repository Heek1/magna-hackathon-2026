import { NavLink } from "react-router-dom";
import type { TabItem } from "@/components/TabBar";
import { cn } from "@/lib/utils";
import { SimSettings } from "@/components/SimSettings";

/** Left navigation for desktop and projector (≥ 1024 px); the same items as the phone TabBar. */
export function SideNav({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav aria-label="Main" className={cn("flex w-60 shrink-0 flex-col gap-6 px-4 py-6", className)}>
      <div className="flex items-center gap-2.5 px-3">
        <span className="h-3 w-3 rounded-sm bg-status-stop" aria-hidden />
        <div className="flex flex-col">
          <span className="text-title-m text-text-primary">OEE Engine</span>
          <span className="text-caption text-text-tertiary">Line L01 · E-drive</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex h-11 items-center gap-3 rounded-badge px-3 text-body font-medium transition-colors",
                  isActive ? "bg-bg-card text-text-primary shadow-card" : "text-text-secondary hover:text-text-primary",
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <SimSettings withLabel className="mt-auto w-full" />
    </nav>
  );
}
