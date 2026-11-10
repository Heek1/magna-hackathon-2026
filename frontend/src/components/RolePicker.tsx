import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { ROLES, type Role } from "@/lib/role";
import { cn } from "@/lib/utils";
import { motion as tokens } from "@/theme/tokens";

/**
 * "Who's on the line?" — the first screen on a new phone, and the role switcher later.
 * One tap; no account, no password.
 */
export function RolePicker({
  current,
  onPick,
  onClose,
}: {
  current?: Role | null;
  onPick: (role: Role) => void;
  /** Shown as a sheet with a close button when changing an existing role. */
  onClose?: () => void;
}) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<Role | null>(null);

  const choose = (role: Role) => {
    if (picked) return;
    setPicked(role);
    window.setTimeout(() => onPick(role), reduce ? 0 : 220); // let the check mark land
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-gutter pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2.5">
        <span className="h-3 w-3 rounded-sm bg-status-stop" aria-hidden />
        <span className="text-body font-semibold text-text-primary">OEE Engine</span>
        <span className="text-caption text-text-tertiary">· Line L01</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-body font-medium text-status-speed">
            Cancel
          </button>
        )}
      </header>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: tokens.ease }}
        className="mt-12"
      >
        <h1 className="text-[40px] font-bold leading-[44px] tracking-tight text-text-primary">
          Who's on
          <br />
          the line?
        </h1>
        <p className="mt-3 max-w-[300px] text-body text-text-secondary">
          We show your fixes first. Change it anytime from the Now screen.
        </p>
      </motion.div>

      <ul className="mt-8 flex flex-col gap-2.5" aria-label="Your role">
        {ROLES.map(({ role, icon: Icon, blurb }, i) => {
          const on = picked === role || (!picked && current === role);
          return (
            <motion.li
              key={role}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: tokens.ease, delay: 0.08 + i * 0.05 }}
            >
              <button
                onClick={() => choose(role)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-4 rounded-card bg-bg-card p-4 text-left shadow-card transition",
                  "active:scale-[0.98] hover:shadow-[0_1px_2px_rgba(16,24,40,.05),0_12px_28px_-6px_rgba(16,24,40,.12)]",
                  on && "ring-2 ring-text-primary",
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-badge transition-colors",
                    on ? "bg-bg-ink text-white" : "bg-bg-subtle text-text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-text-primary">{role}</span>
                  <span className="block text-caption text-text-secondary">{blurb}</span>
                </span>
                {on ? (
                  <Check className="h-5 w-5 text-text-primary" strokeWidth={2.5} aria-hidden />
                ) : (
                  <ChevronRight className="h-5 w-5 text-text-tertiary" aria-hidden />
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>

      <p className="mt-auto pt-8 text-center text-caption text-text-tertiary">
        No account needed · stored only on this phone
      </p>
    </div>
  );
}
