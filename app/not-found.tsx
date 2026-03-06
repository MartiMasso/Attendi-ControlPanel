import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-xl">
      <Card className="text-center">
        <h1 className="text-xl font-semibold text-text">Page not found</h1>
        <p className="mt-2 text-sm text-text-muted">The requested resource does not exist or may have been removed.</p>
        <div className="mt-5">
          <Link href="/dashboard">
            <Button size="sm">Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
