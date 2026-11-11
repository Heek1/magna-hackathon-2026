import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button border font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        /** Main action: ink button, e.g. "Assign", "Create action". */
        primary: "border-transparent bg-action text-action-text hover:bg-action/90",
        /** Secondary control on a card. */
        default: "border-border bg-bg-card text-text-primary hover:bg-bg-subtle",
        /** Floating round control on the canvas, e.g. the Back button. */
        surface: "border-transparent bg-bg-card text-text-primary shadow-card hover:bg-bg-subtle",
        /** Destructive / urgent. */
        action: "border-status-stop/40 bg-status-stop-bg text-status-stop hover:bg-status-stop hover:text-white",
        /** Quiet control. */
        ghost: "border-transparent text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
        /** Selected state of a toggle. */
        selected: "border-transparent bg-bg-ink text-white",
      },
      size: {
        // 36 px to the eye, 44 px to the finger: an invisible hit area above and below.
        sm: "relative h-9 rounded-chip px-4 text-caption before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        md: "h-11 px-4 text-body",
        lg: "h-[52px] px-5 text-title-m font-medium",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
