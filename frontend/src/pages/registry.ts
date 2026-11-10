/**
 * Page registry. Now (src/pages/live) is built here; the other screens are owned by member 1 and
 * picked up automatically when they exist — no stubs in their folders. Conventions:
 *   Top errors    → src/pages/analysis/index.tsx                 (route /errors)
 *   Error detail  → src/pages/analysis/ErrorDetail.tsx  or  ErrorDetail/index.tsx  (/errors/:code)
 *   Fixes         → src/pages/actions/index.tsx                  (route /fixes)
 * A page default-exports a component. Error detail may instead export
 * `ErrorDetail({ code, onBack })`; the adapter below feeds it the :code route param.
 */
import { createElement, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Page = LazyExoticComponent<ComponentType>;
type Module = { default?: ComponentType; ErrorDetail?: ComponentType<{ code: string; onBack: () => void }> };

const modules = import.meta.glob<Module>([
  "./analysis/index.tsx",
  "./analysis/ErrorDetail.tsx",
  "./analysis/ErrorDetail/index.tsx",
  "./actions/index.tsx",
]);

function page(...paths: string[]): Page | null {
  const loader = paths.map((p) => modules[p]).find(Boolean);
  if (!loader) return null;
  return lazy(async () => {
    const m = await loader();
    if (m.default) return { default: m.default };
    if (m.ErrorDetail) return { default: routeErrorDetail(m.ErrorDetail) };
    throw new Error(`${paths[0]} exports neither a default page nor ErrorDetail`);
  });
}

/** /errors/:code → <ErrorDetail code onBack/>; Back returns to Top errors. */
function routeErrorDetail(Detail: NonNullable<Module["ErrorDetail"]>): ComponentType {
  return function ErrorDetailRoute() {
    const { code = "" } = useParams();
    const navigate = useNavigate();
    return createElement(Detail, { key: code, code, onBack: () => navigate("/errors") });
  };
}

export const TopErrorsPage = page("./analysis/index.tsx");
export const ErrorDetailPage = page("./analysis/ErrorDetail.tsx", "./analysis/ErrorDetail/index.tsx");
export const FixesPage = page("./actions/index.tsx");
