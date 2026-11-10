/** Types mirror CONTRACT.md 1:1. Do not change without the team lead. */

/** ISO datetime in plant local time, e.g. "2026-11-25T09:14:00". */
export type IsoDateTime = string;
/** ISO date, e.g. "2026-11-25". */
export type IsoDate = string;

export interface ShiftKpis {
  date: IsoDate;
  hour: number; // 1..8
  plan_min: number;
  run_min: number;
  downtime_min: number;
  produced: number;
  ok: number;
  nok: number;
  availability: number; // 0..1
  performance: number;
  quality: number;
  oee: number;
  target: number;
}

export interface ActiveDowntime {
  code: string;
  device: string;
  description: string;
  since: IsoDateTime;
}

export interface SimState {
  sim_time: IsoDateTime;
  shift: ShiftKpis;
  hours: ShiftKpis[];
  active_downtime: ActiveDowntime | null;
}

export interface HistoryPoint {
  date: IsoDate;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  downtime_min: number;
  nok: number;
}

export type HeatmapMetric = "oee" | "performance" | "downtime";
export interface HeatmapCell {
  date: IsoDate;
  hour: number;
  value: number;
}

export type LossType = "downtime" | "microstop" | "retest" | "slowdown" | "nok";
export interface Loss {
  type: LossType;
  code: string;
  device: string | null;
  description: string;
  loss_pcs: number;
  loss_pp: number;
  count: number;
}

export type InsightKind = "recurring_stop" | "prediction" | "slow_hour" | "quality" | "anomaly";
export type Severity = "high" | "medium" | "low";
export interface Recommendation {
  action: string;
  method: string;
  owner_role: string;
  expected_gain_pcs: number;
}
export interface Insight {
  id: string;
  kind: InsightKind;
  severity: Severity;
  title: string;
  evidence: string;
  code: string;
  loss_pcs: number;
  loss_pp: number;
  expected_at: IsoDateTime | null;
  recommendation: Recommendation;
}

export interface WhatIfRequest {
  remove: string[];
  from: IsoDate;
  to: IsoDate;
}
export interface WhatIfResponse {
  oee_before: number;
  oee_after: number;
  gain_pcs: number;
  gain_pp: number;
}

export type ActionStatus = "open" | "in_progress" | "done";
export interface Action {
  id: string;
  insight_id: string;
  title: string;
  owner: string;
  status: ActionStatus;
  created_at: IsoDateTime;
}

export interface SimControl {
  speed?: number;
  jump_to?: IsoDateTime;
  paused?: boolean;
}
