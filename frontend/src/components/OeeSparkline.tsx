import { colors } from "@/theme/tokens";

export interface OeeSparklineProps {
  /** OEE per shift hour so far, fractions 0..1, oldest first. */
  values: number[];
  /** Fraction 0..1, drawn as a dashed line. */
  target: number;
  /** Hours in a full shift; the line fills the width as the shift goes on. */
  slots?: number;
  className?: string;
}

const W = 160;
const H = 48;
const PAD = 5;

/** Small line of OEE by shift hour against the target: is the shift getting better or worse? */
export function OeeSparkline({ values, target, slots = 8, className }: OeeSparklineProps) {
  if (values.length === 0) return null;
  const lo = Math.min(0.5, target - 0.1, ...values);
  const y = (v: number) => PAD + (1 - (Math.min(1, v) - lo) / (1 - lo)) * (H - 2 * PAD);
  const x = (i: number) => PAD + (i / (slots - 1)) * (W - 2 * PAD);
  const points = values.map((v, i) => [x(i), y(v)] as const);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  const last = values[values.length - 1];
  const color = last >= target ? colors.fix : colors.stop;
  const area = `${line} L${lastX.toFixed(1)} ${H} L${points[0][0].toFixed(1)} ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`OEE by hour, latest ${Math.round(last * 100)} percent, target ${Math.round(target * 100)} percent`}
    >
      <line x1={PAD} x2={W - PAD} y1={y(target)} y2={y(target)} stroke={colors.tertiary} strokeWidth="1" strokeDasharray="3 3" />
      <path d={area} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3.5" fill={color} stroke={colors.card} strokeWidth="1.5" />
    </svg>
  );
}
