import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text shadow-sm outline-none transition focus:border-primary",
        className
      )}
      {...props}
    />
  );
}
