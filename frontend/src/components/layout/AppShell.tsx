import type { ReactNode } from "react";
import { SideNav, type NavItem } from "@/components/layout/SideNav";
import { TopBar } from "@/components/layout/TopBar";

/** Control-room frame: side rail + header + scrollable page. Sized for 1920×1080. */
export function AppShell({ nav, title, children }: { nav: NavItem[]; title: string; children: ReactNode }) {
  return (
    <div className="flex h-full min-w-[1280px]">
      <SideNav items={nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main className="min-h-0 flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
