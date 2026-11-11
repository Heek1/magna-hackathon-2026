import { colors } from "@/theme/tokens";

/** Small illustration for "no errors": a part on a belt with a green check above it. */
export function CleanLineArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 72" className={className} aria-hidden>
      <rect x="10" y="52" width="100" height="10" rx="5" fill={colors.subtle} stroke={colors.line} />
      {[24, 48, 72, 96].map((cx) => (
        <circle key={cx} cx={cx} cy="57" r="2.5" fill={colors.tertiary} />
      ))}
      <rect x="44" y="30" width="32" height="22" rx="5" fill={colors.card} stroke={colors.tertiary} strokeWidth="1.5" />
      <line x1="52" y1="38" x2="68" y2="38" stroke={colors.line} strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="44" x2="62" y2="44" stroke={colors.line} strokeWidth="2" strokeLinecap="round" />
      <circle cx="78" cy="22" r="11" fill={colors["fix-bg"]} />
      <path d="M73 22l3.5 3.5L83 19" fill="none" stroke={colors.fix} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
