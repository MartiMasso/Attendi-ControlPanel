import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  value: string | null | undefined;
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = (value ?? "unknown").toLowerCase();
  const label = normalized.replace(/_/g, " ");

  if (["approved", "active", "resolved", "completed", "success"].includes(normalized)) {
    return <Badge color="success">{label}</Badge>;
  }

  if (["new", "pending", "in_review", "review", "processing", "open", "needs_changes"].includes(normalized)) {
    return <Badge color="warning">{label}</Badge>;
  }

  if (["rejected", "cancelled", "failed", "error"].includes(normalized)) {
    return <Badge color="danger">{label}</Badge>;
  }

  return <Badge color="neutral">{label}</Badge>;
}
