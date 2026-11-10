import { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { motion as tokens } from "@/theme/tokens";

export interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  className?: string;
}

/**
 * Number that tweens smoothly to its new value.
 * Text is owned by this effect (not by React children), so there is no re-render per frame and no flash.
 */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (reduce || from === null || from === value) {
      el.textContent = format(value);
      return;
    }
    el.textContent = format(from);
    const controls = animate(from, value, {
      duration: tokens.number,
      ease: tokens.ease,
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, format, reduce]);

  return <span ref={ref} className={className} />;
}
