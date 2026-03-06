import { Card } from "@/components/ui/card";

export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-danger/30 bg-[#fff6f7]">
      <h3 className="text-sm font-semibold text-danger">Unable to load section</h3>
      <p className="mt-1 text-sm text-text-muted">{message}</p>
    </Card>
  );
}
