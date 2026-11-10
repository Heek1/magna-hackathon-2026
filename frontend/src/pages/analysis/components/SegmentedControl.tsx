import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("flex w-full items-center rounded-[16px] bg-[#F6F7F9] p-1 border border-[#E6E8EC]/60", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] transition-all rounded-[12px]",
              active
                ? "bg-white text-[#0B0D12] font-semibold shadow-[0_1px_3px_rgba(16,24,40,0.08)]"
                : "text-[#5F6672] font-medium hover:text-[#0B0D12]",
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[11px] font-mono",
                  active ? "bg-[#F3F4F7] text-[#0B0D12]" : "bg-transparent text-[#9AA1AD]",
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
