/**
 * Mocks. The *.json files (except insights.sample.json) are dumped from the real backend by
 * backend/scripts/dump_mocks.py — snapshot Wed 2026-11-25 09:20, ST-038 active since 09:08.
 *
 * insights.sample.json: contract-shaped example insights (prediction, recurring stop, …) used
 * while backend/insights is still a stub, so the insight feed can be built and shown.
 */
import type { Action, HeatmapCell, HistoryPoint, Insight, Loss, SimControlState, SimState, WhatIfResponse } from "@/types/api";
import state from "./state.json";
import losses from "./losses.json";
import insightsStub from "./insights.json";
import insightsSample from "./insights.sample.json";
import actions from "./actions.json";
import simControl from "./sim_control.json";
import history from "./history.json";
import heatmap from "./heatmap.json";
import whatif from "./whatif.json";

export const mockState = state as SimState;
export const mockLosses = losses as Loss[];
export const mockInsightsStub = insightsStub as unknown as Insight[];
export const mockInsights = insightsSample as Insight[];
export const mockActions = actions as Action[];
export const mockSimControl = simControl as SimControlState;
export const mockHistory = history as HistoryPoint[];
export const mockHeatmap = heatmap as HeatmapCell[];
export const mockWhatIf = whatif as WhatIfResponse;
