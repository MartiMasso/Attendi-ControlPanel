"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Useful for debugging in local development.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-24 max-w-xl">
      <Card className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-text">Unexpected error</h2>
        <p className="text-sm text-text-muted">The panel could not complete this request. Try again or check service connectivity.</p>
        <div>
          <Button onClick={reset} size="sm">
            Retry
          </Button>
        </div>
      </Card>
    </div>
  );
}
