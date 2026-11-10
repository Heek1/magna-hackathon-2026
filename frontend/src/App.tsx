import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SimProvider } from "@/api/hooks";
import { AppShell } from "@/components/layout/AppShell";
import { navIcons, type NavItem } from "@/components/layout/SideNav";
import { Panel } from "@/components/Panel";
import LivePage from "@/pages/live/LivePage";
import { externalPage } from "@/pages/registry";

const AnalysisPage = externalPage("analysis");
const ActionsPage = externalPage("actions");

const nav: NavItem[] = [
  { to: "/", label: "Live", icon: navIcons.live, available: true },
  { to: "/analysis", label: "Analysis", icon: navIcons.analysis, available: !!AnalysisPage },
  { to: "/actions", label: "Actions", icon: navIcons.actions, available: !!ActionsPage },
];

function Shell() {
  const { pathname } = useLocation();
  const title = nav.find((n) => n.to === pathname)?.label ?? "Live";
  return (
    <AppShell nav={nav} title={title}>
      <Suspense fallback={<Panel state="loading" className="h-full" />}>
        <Routes>
          <Route path="/" element={<LivePage />} />
          {AnalysisPage && <Route path="/analysis" element={<AnalysisPage />} />}
          {ActionsPage && <Route path="/actions" element={<ActionsPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <SimProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </SimProvider>
  );
}
