import type { IsoDateTime, Loss } from "@/types/api";

export interface LossFix {
  action: string;
  method: string;
  owner_role: string;
}

export interface LossWithFix extends Loss {
  fix?: LossFix | null;
}

export interface ErrorPatternCell {
  weekday: string;
  hour: number;
  count: number;
}

export interface ErrorOccurrence {
  start: IsoDateTime;
  minutes: number | null;
  pcs: number;
}

export interface ErrorDetailData {
  code: string;
  kind: "stop" | "defect" | "speed";
  description: string;
  device: string | null;
  count: number;
  minutes: number;
  loss_pcs: number;
  loss_pp: number;
  pattern: ErrorPatternCell[];
  occurrences: ErrorOccurrence[];
  next_expected: IsoDateTime | null;
  fix: LossFix | null;
  gain_pp: number;
}
