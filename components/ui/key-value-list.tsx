export function KeyValueList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-surface-elevated p-3">
          <dt className="text-xs uppercase tracking-[0.06em] text-text-muted">{item.label}</dt>
          <dd className="mt-1 text-sm font-medium text-text">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
