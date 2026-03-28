"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FeedbackLiveUpdates({ initialLatestCreatedAt }: { initialLatestCreatedAt: string | null }) {
  const router = useRouter();
  const [latestCreatedAt, setLatestCreatedAt] = useState<string | null>(initialLatestCreatedAt);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLatestCreatedAt(initialLatestCreatedAt);
  }, [initialLatestCreatedAt]);

  useEffect(() => {
    let isMounted = true;

    const checkForUpdates = async () => {
      const params = new URLSearchParams();

      if (latestCreatedAt) {
        params.set("after", latestCreatedAt);
      }

      const suffix = params.toString();
      const response = await fetch(`/api/feedback/latest${suffix ? `?${suffix}` : ""}`, {
        method: "GET",
        cache: "no-store"
      }).catch(() => null);

      if (!response?.ok || !isMounted) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        latestCreatedAt?: string | null;
        hasNewSince?: boolean;
      } | null;

      if (!payload) {
        return;
      }

      if (payload.latestCreatedAt) {
        setLatestCreatedAt(payload.latestCreatedAt);
      }

      if (payload.hasNewSince) {
        startTransition(() => {
          router.refresh();
        });
      }
    };

    const interval = window.setInterval(() => {
      void checkForUpdates();
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [latestCreatedAt, router, startTransition]);

  if (!latestCreatedAt) {
    return null;
  }

  return (
    <p className="text-xs text-text-muted">
      Live updates {isPending ? "syncing..." : "enabled"} (15s)
    </p>
  );
}
