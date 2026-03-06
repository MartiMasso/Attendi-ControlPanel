import { Card } from "@/components/ui/card";

export function MetricCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-text-muted">{title}</p>
      <p className="mt-3 text-3xl font-semibold leading-none text-text">{value}</p>
      {subtitle ? <p className="mt-2 text-xs text-text-muted">{subtitle}</p> : null}
    </Card>
  );
}
