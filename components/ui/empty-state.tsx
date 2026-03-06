import { Card } from "@/components/ui/card";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed text-center">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
    </Card>
  );
}
