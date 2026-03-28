import { Badge } from "@/components/ui/badge";

export function FeedbackCategoryBadge({ value }: { value: string | null | undefined }) {
  const normalized = String(value ?? "other").toLowerCase();

  if (normalized === "bug") {
    return <Badge color="danger">bug</Badge>;
  }

  if (normalized === "suggestion") {
    return <Badge color="info">suggestion</Badge>;
  }

  return <Badge color="neutral">other</Badge>;
}
