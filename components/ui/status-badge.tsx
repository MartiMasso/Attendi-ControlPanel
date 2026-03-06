import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  value: string | null | undefined;
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = (value ?? "unknown").toLowerCase();

  if (["approved", "active", "resolved", "completed", "success"].includes(normalized)) {
    return <Badge color="success">{normalized}</Badge>;
  }

  if (["pending", "in_review", "review", "processing", "open"].includes(normalized)) {
    return <Badge color="warning">{normalized}</Badge>;
  }

  if (["rejected", "cancelled", "failed", "error"].includes(normalized)) {
    return <Badge color="danger">{normalized}</Badge>;
  }

  return <Badge color="neutral">{normalized}</Badge>;
}
