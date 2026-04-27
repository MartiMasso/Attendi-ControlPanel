"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function normalizeInputValue(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function parsePercent(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function useCommissionSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (request: () => Promise<Response>, successMessage: string) => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      let response: Response;

      try {
        response = await request();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Network error while updating commission settings.");
        return;
      }

      const responseText = await response.text().catch(() => "");
      const payload = responseText
        ? ((() => {
            try {
              return JSON.parse(responseText) as { error?: string };
            } catch {
              return null;
            }
          })())
        : null;

      if (!response.ok) {
        setError(payload?.error ?? (responseText || `Unable to update commission settings (${response.status}).`));
        return;
      }

      setSuccess(successMessage);
      router.refresh();
    });
  };

  return {
    error,
    success,
    isPending,
    submit
  };
}

export function StandardCommissionForm({
  entityId,
  currentCommissionPct,
  className
}: {
  entityId: string;
  currentCommissionPct: number;
  className?: string;
}) {
  const [value, setValue] = useState(normalizeInputValue(currentCommissionPct));
  const { error, success, isPending, submit } = useCommissionSubmit();
  const parsed = parsePercent(value);
  const isValid = parsed !== null && parsed >= 0 && parsed <= 100;
  const isDirty = isValid && Math.abs((parsed ?? 0) - currentCommissionPct) >= 0.005;

  return (
    <form
      className={cn("rounded-xl border border-border bg-surface-muted p-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValid || parsed === null) {
          return;
        }

        submit(
          () =>
            fetch(`/api/business-performance/entities/${entityId}/commission`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ commissionPct: parsed })
            }),
          "Comisión estándar actualizada."
        );
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Comisión estándar empresa</p>
          <p className="mt-1 text-xs text-text-muted">
            Se aplica cuando la reserva no viene atribuida a un hotel.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="block w-28 text-xs font-medium text-text-muted">
            CE_p (%)
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-1 bg-white"
            />
          </label>
          <Button type="submit" size="sm" disabled={isPending || !isValid || !isDirty}>
            <Save size={14} />
            Guardar
          </Button>
        </div>
      </div>
      {!isValid ? <p className="mt-2 text-xs text-danger">Introduce un porcentaje entre 0 y 100.</p> : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-success">{success}</p> : null}
    </form>
  );
}

export function HotelSplitCommissionForm({
  hotelId,
  currentKHotelPct,
  referenceCePPct,
  className
}: {
  hotelId: string;
  currentKHotelPct: number;
  referenceCePPct: number;
  className?: string;
}) {
  const [value, setValue] = useState(normalizeInputValue(currentKHotelPct));
  const { error, success, isPending, submit } = useCommissionSubmit();
  const parsed = parsePercent(value);
  const isValid = parsed !== null && parsed >= 0 && parsed <= 100;
  const kHotelPct = isValid && parsed !== null ? parsed : currentKHotelPct;
  const attendiSharePct = Math.max(0, 100 - kHotelPct);
  const hotelResultPct = (referenceCePPct * kHotelPct) / 100;
  const attendiResultPct = (referenceCePPct * attendiSharePct) / 100;
  const isDirty = isValid && Math.abs((parsed ?? 0) - currentKHotelPct) >= 0.005;

  return (
    <form
      className={cn("rounded-xl border border-border bg-surface-muted p-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValid || parsed === null) {
          return;
        }

        submit(
          () =>
            fetch(`/api/hotels/${hotelId}/commission-split`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kHotelPct: parsed })
            }),
          "Reparto del hotel actualizado."
        );
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">k_hotel</p>
          <p className="mt-1 text-xs text-text-muted">Porcentaje de la CE_p que se queda el hotel.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="block w-28 text-xs font-medium text-text-muted">
            Hotel (%)
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-1 bg-white"
            />
          </label>
          <Button type="submit" size="sm" disabled={isPending || !isValid || !isDirty}>
            <Save size={14} />
            Guardar
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-2">
        <div>Hotel retiene {formatPercent(kHotelPct)} de la comisión.</div>
        <div>Attendi retiene {formatPercent(attendiSharePct)} de la comisión.</div>
        <div>Con CE_p {formatPercent(referenceCePPct)}: Hotel {formatPercent(hotelResultPct)}</div>
        <div>Con CE_p {formatPercent(referenceCePPct)}: Attendi {formatPercent(attendiResultPct)}</div>
      </div>
      {!isValid ? <p className="mt-2 text-xs text-danger">Introduce un porcentaje entre 0 y 100.</p> : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-success">{success}</p> : null}
    </form>
  );
}

export function HotelPartnerCommissionForm({
  hotelId,
  locationId,
  companyId,
  currentEffectivePct,
  standardPct,
  hasCustom,
  currentKHotelPct,
  defaultKHotelPct,
  compact = false
}: {
  hotelId: string;
  locationId: string | null;
  companyId: string;
  currentEffectivePct: number;
  standardPct: number;
  hasCustom: boolean;
  currentKHotelPct: number;
  defaultKHotelPct: number;
  compact?: boolean;
}) {
  const [value, setValue] = useState(normalizeInputValue(currentEffectivePct));
  const [kValue, setKValue] = useState(normalizeInputValue(currentKHotelPct));
  const { error, success, isPending, submit } = useCommissionSubmit();
  const parsed = parsePercent(value);
  const parsedK = parsePercent(kValue);
  const isValid = parsed !== null && parsed >= 0 && parsed <= 100;
  const isKValid = parsedK !== null && parsedK >= 0 && parsedK <= 100;
  const effectivePct = isValid && parsed !== null ? parsed : currentEffectivePct;
  const effectiveKHotelPct = isKValid && parsedK !== null ? parsedK : currentKHotelPct;
  const hotelPct = (effectivePct * effectiveKHotelPct) / 100;
  const attendiPct = effectivePct - hotelPct;
  const isDirty =
    isValid &&
    isKValid &&
    (Math.abs((parsed ?? 0) - currentEffectivePct) >= 0.005 || Math.abs((parsedK ?? 0) - currentKHotelPct) >= 0.005);

  const resetToStandard = () => {
    submit(
      () =>
        fetch(`/api/hotels/${hotelId}/partners/${companyId}/commission`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "standard", locationId })
        }),
      "Override eliminado."
    );
  };

  return (
    <form
      className={cn("space-y-2", compact ? "min-w-[220px]" : "rounded-xl border border-border bg-surface-muted p-4")}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValid || parsed === null) {
          return;
        }

        submit(
          () =>
            fetch(`/api/hotels/${hotelId}/partners/${companyId}/commission`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "custom", cePPct: parsed, kHotelPct: parsedK, locationId })
            }),
          "Comisión partner actualizada."
        );
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="block w-24 text-xs font-medium text-text-muted">
          CE_p (%)
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="mt-1 bg-white"
          />
        </label>
        <label className="block w-24 text-xs font-medium text-text-muted">
          Hotel (%)
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={kValue}
            onChange={(event) => setKValue(event.target.value)}
            className="mt-1 bg-white"
          />
        </label>
        <Button type="submit" size="sm" disabled={isPending || !isValid || !isKValid || !isDirty}>
          <Save size={14} />
          Guardar
        </Button>
        {hasCustom ? (
          <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={resetToStandard}>
            <RotateCcw size={14} />
          </Button>
        ) : null}
      </div>
      <div className="text-xs text-text-muted">
        Hotel {formatPercent(hotelPct)} | Attendi {formatPercent(attendiPct)}
        <span className="ml-1">· CE_p estándar {formatPercent(standardPct)}</span>
        <span className="ml-1">· k defecto {formatPercent(defaultKHotelPct)}</span>
      </div>
      {!isValid ? <p className="text-xs text-danger">Introduce 0-100.</p> : null}
      {!isKValid ? <p className="text-xs text-danger">Introduce k_hotel entre 0 y 100.</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success ? <p className="text-xs text-success">{success}</p> : null}
    </form>
  );
}
