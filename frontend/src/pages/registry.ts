/**
 * Page registry. Now (src/pages/live) is built here; the other screens are owned by member 1 and
 * picked up automatically when they exist — no stubs in their folders. Conventions:
 *   Top errors    → src/pages/analysis/index.tsx                 (route /errors)
 *   Error detail  → src/pages/analysis/ErrorDetail.tsx  or  ErrorDetail/index.tsx  (/errors/:code)
 *   Fixes         → src/pages/actions/index.tsx                  (route /fixes)
 * Each file default-exports a component. Error detail reads the code with useParams().
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type Page = LazyExoticComponent<ComponentType>;

const modules = import.meta.glob<{ default: ComponentType }>([
  "./analysis/index.tsx",
  "./analysis/ErrorDetail.tsx",
  "./analysis/ErrorDetail/index.tsx",
  "./actions/index.tsx",
]);

function page(...paths: string[]): Page | null {
  const loader = paths.map((p) => modules[p]).find(Boolean);
  return loader ? lazy(loader) : null;
}

export const TopErrorsPage = page("./analysis/index.tsx");
export const ErrorDetailPage = page("./analysis/ErrorDetail.tsx", "./analysis/ErrorDetail/index.tsx");
export const FixesPage = page("./actions/index.tsx");
