import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  rightSlot,
  className
}: {
  title: string;
  description?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
      {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
    </header>
  );
}
