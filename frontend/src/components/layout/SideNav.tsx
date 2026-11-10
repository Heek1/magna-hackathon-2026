import { NavLink } from "react-router-dom";
import { Activity, ChartColumn, ListChecks, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** False while the page is not built yet. */
  available: boolean;
}

export const navIcons = { live: Activity, analysis: ChartColumn, actions: ListChecks };

/** Left rail: product mark + three sections. */
export function SideNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="flex w-56 shrink-0 flex-col border-r bg-bg">
      <div className="flex h-[72px] items-center gap-2.5 border-b px-5">
        <span className="h-3 w-3 bg-accent" aria-hidden />
        <div className="flex flex-col leading-tight">
          <span className="num text-sm font-semibold tracking-wide text-text">OEE ENGINE</span>
          <span className="label text-dim">Line L01 · E-drive</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1 p-3">
        {items.map(({ to, label, icon: Icon, available }) => (
          <li key={to}>
            {available ? (
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative flex h-11 items-center gap-3 rounded px-3 text-sm font-medium transition-colors",
                    isActive ? "bg-surface-2 text-text" : "text-muted hover:bg-surface hover:text-text",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-y-2 left-0 w-0.5 bg-text" aria-hidden />}
                    <Icon className="h-4 w-4" />
                    {label}
                  </>
                )}
              </NavLink>
            ) : (
              <span className="flex h-11 cursor-not-allowed items-center gap-3 rounded px-3 text-sm text-dim">
                <Icon className="h-4 w-4" />
                {label}
                <span className="label ml-auto text-dim">Soon</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
