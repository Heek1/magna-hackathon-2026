import { Suspense, type ComponentType, type ReactNode } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { ChartColumn, Clock, SquareCheck } from "lucide-react";
import { TabBar, type TabItem } from "@/components/TabBar";
import { SideNav } from "@/components/layout/SideNav";
import { Card } from "@/components/Card";
import { StateView } from "@/components/Panel";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { useDocumentLang, useT } from "@/lib/i18n";
import { useRole } from "@/lib/role";
import { RolePicker } from "@/components/RolePicker";
import { cn } from "@/lib/utils";

function useAppTabs(): TabItem[] {
  const t = useT();
  return [
    { to: "/", label: t("nav.now"), icon: Clock },
    { to: "/errors", label: t("nav.errors"), icon: ChartColumn },
    { to: "/fixes", label: t("nav.fixes"), icon: SquareCheck },
  ];
}

/**
 * Phone: one screen at a time with the bottom TabBar (hidden on Error detail).
 * Desktop ≥ 1024 px: left nav; the routed screen fills the main area (see DesktopBoard).
 */
export function AppShell() {
  const desktop = useIsDesktop();
  const onDetail = !!useMatch("/errors/:code");
  const [role, setRole] = useRole();
  const appTabs = useAppTabs();
  useDocumentLang();

  // First visit on this phone: one tap to say who you are (no account, no password).
  if (!role) return <RolePicker onPick={setRole} />;

  if (desktop) {
    return (
      <div className="h-viewport flex overflow-hidden">
        <SideNav items={appTabs} />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <>
      <main
        className={cn(
          "mx-auto min-h-dvh max-w-md px-gutter pt-[max(16px,env(safe-area-inset-top))]",
          onDetail ? "pb-0" : "pb-[calc(88px+env(safe-area-inset-bottom))]",
        )}
      >
        <Outlet />
      </main>
      {!onDetail && <TabBar items={appTabs} />}
    </>
  );
}

/**
 * Desktop and projector: Now and Top errors side by side; Error detail as a right-hand panel.
 * Each column scrolls on its own.
 */
export function DesktopBoard({ now, errors, detail }: { now: ReactNode; errors: ReactNode; detail?: ReactNode }) {
  return (
    <div
      className={cn(
        "grid h-full gap-6 px-2 py-6 pr-6",
        detail ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(380px,440px)]" : "grid-cols-2",
      )}
    >
      <Column>{now}</Column>
      <Column>{errors}</Column>
      {detail && (
        <aside aria-label="Error detail" className="scroll-thin min-h-0 overflow-y-auto rounded-hero bg-bg-card px-gutter shadow-card">
          {detail}
        </aside>
      )}
    </div>
  );
}

function Column({ children }: { children: ReactNode }) {
  return <section className="scroll-thin min-h-0 overflow-y-auto px-2">{children}</section>;
}

/** A screen owned by another member, or a placeholder while it is not built yet. */
export function ScreenSlot({ page: Page, name, file }: { page: ComponentType | null; name: string; file: string }) {
  if (!Page)
    return (
      <Card className="mt-4">
        <p className="text-title-m">{name}</p>
        <p className="mt-1 text-caption text-text-secondary">
          Not built yet — expected in <code className="num">{file}</code>.
        </p>
      </Card>
    );
  return (
    <Suspense
      fallback={
        <div className="pt-4">
          <StateView state="loading" />
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}
