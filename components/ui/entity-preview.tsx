export function EntityPreview({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  if (!value) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-elevated p-4 text-sm text-text-muted">
        {title} is not available for this entity.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <p className="mb-3 text-sm font-semibold text-text">{title}</p>
      <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs text-text-muted">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
