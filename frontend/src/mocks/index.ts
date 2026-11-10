/**
 * Stage-1 mocks: a real snapshot from data/oee.xlsx —
 * Wed 2026-11-25 09:14, hours 1–3 complete, ST-038 (camera light module) active since 09:08.
 */
import type { Insight, Loss, SimState } from "@/types/api";
import state from "./state.json";
import losses from "./losses.json";
import insights from "./insights.json";

export const mockState = state as SimState;
export const mockLosses = losses as Loss[];
export const mockInsights = insights as Insight[];
