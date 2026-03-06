import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text shadow-sm outline-none transition focus:border-primary",
        className
      )}
      {...props}
    />
  );
}
