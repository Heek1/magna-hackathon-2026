/**
 * Page registry. Live is built here; Analysis and Actions are owned by another member and
 * picked up automatically when they exist — convention: `src/pages/<name>/index.tsx`
 * with a default-exported component. No stubs needed in their folders.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const modules = import.meta.glob<{ default: ComponentType }>("./{analysis,actions}/index.tsx");

export function externalPage(name: "analysis" | "actions"): LazyExoticComponent<ComponentType> | null {
  const loader = modules[`./${name}/index.tsx`];
  return loader ? lazy(loader) : null;
}
