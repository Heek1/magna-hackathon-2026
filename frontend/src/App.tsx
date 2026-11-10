import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SimProvider } from "@/api/hooks";
import { AppShell, DesktopBoard, ScreenSlot } from "@/components/layout/AppShell";
import { useIsDesktop } from "@/lib/useMediaQuery";
import NowPage from "@/pages/live/NowPage";
import { ErrorDetailPage, FixesPage, TopErrorsPage } from "@/pages/registry";

// Dev-only board of the shared components (not in the production build).
const ComponentsBoard = import.meta.env.DEV ? lazy(() => import("@/pages/dev/ComponentsBoard")) : null;

const topErrors = <ScreenSlot page={TopErrorsPage} name="Top errors" file="src/pages/analysis/index.tsx" />;
const errorDetail = (
  <ScreenSlot page={ErrorDetailPage} name="Error detail" file="src/pages/analysis/ErrorDetail.tsx" />
);
const fixes = <ScreenSlot page={FixesPage} name="Fixes" file="src/pages/actions/index.tsx" />;

/** Routes: / (Now), /errors (Top errors), /errors/:code (Error detail), /fixes. */
function Screens() {
  const desktop = useIsDesktop();
  const board = (detail?: JSX.Element) => <DesktopBoard now={<NowPage />} errors={topErrors} detail={detail} />;

  return (
    <Routes>
      {ComponentsBoard && (
        <Route
          path="/components"
          element={
            <Suspense fallback={null}>
              <ComponentsBoard />
            </Suspense>
          }
        />
      )}
      <Route element={<AppShell />}>
        <Route index element={desktop ? board() : <NowPage />} />
        <Route path="errors" element={desktop ? board() : topErrors} />
        <Route path="errors/:code" element={desktop ? board(errorDetail) : errorDetail} />
        <Route path="fixes" element={desktop ? <div className="h-full overflow-y-auto p-6">{fixes}</div> : fixes} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <SimProvider>
      <BrowserRouter>
        <Screens />
      </BrowserRouter>
    </SimProvider>
  );
}
