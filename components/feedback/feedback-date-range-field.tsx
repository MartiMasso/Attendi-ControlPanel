"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parsed);
}

function getRangeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo) {
    return `${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)}`;
  }

  if (dateFrom) {
    return `${formatDateLabel(dateFrom)} - ...`;
  }

  if (dateTo) {
    return `... - ${formatDateLabel(dateTo)}`;
  }

  return "Select date range";
}

export function FeedbackDateRangeField({
  defaultDateFrom,
  defaultDateTo,
  nameFrom,
  nameTo
}: {
  defaultDateFrom: string;
  defaultDateTo: string;
  nameFrom: string;
  nameTo: string;
}) {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDateFrom(defaultDateFrom);
    setDateTo(defaultDateTo);
  }, [defaultDateFrom, defaultDateTo]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  const label = useMemo(() => getRangeLabel(dateFrom, dateTo), [dateFrom, dateTo]);

  return (
    <div className="relative" ref={rootRef}>
      <input type="hidden" name={nameFrom} value={dateFrom} />
      <input type="hidden" name={nameTo} value={dateTo} />

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 text-left text-sm text-text shadow-sm transition hover:border-primary"
      >
        <span className={dateFrom || dateTo ? "text-text" : "text-text-muted"}>{label}</span>
        <Calendar size={14} className="text-text-muted" />
      </button>

      {open ? (
        <div className="absolute left-0 top-12 z-30 w-full min-w-[300px] rounded-xl border border-border bg-surface-elevated p-3 shadow-card">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-text-muted">
              Start
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  const nextDateFrom = event.target.value;
                  setDateFrom(nextDateFrom);

                  if (dateTo && nextDateFrom && nextDateFrom > dateTo) {
                    setDateTo(nextDateFrom);
                  }
                }}
                className="mt-1"
              />
            </label>
            <label className="text-xs text-text-muted">
              End
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  const nextDateTo = event.target.value;
                  setDateTo(nextDateTo);

                  if (dateFrom && nextDateTo && nextDateTo < dateFrom) {
                    setDateFrom(nextDateTo);
                  }
                }}
                className="mt-1"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
