import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[22px] bg-white p-4 transition-all border border-[#E6E8EC]/80 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.06)]",
        onClick && "cursor-pointer hover:border-[#D5D9E0] active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </div>
  );
}
