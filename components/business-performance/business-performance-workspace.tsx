"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calculator, CheckSquare, ChevronRight, MapPin, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { calculateCommissionCents, toEuroCurrency } from "@/lib/business-performance";
import { cn } from "@/lib/utils";
import type { BusinessPerformanceEntityDetail, BusinessPerformanceEntityRow } from "@/types";

interface BusinessPerformanceWorkspaceProps {
  entities: BusinessPerformanceEntityRow[];
  selectedEntityId: string | null;
  selectedEntityDetail: BusinessPerformanceEntityDetail | null;
  periodLabel: string;
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function formatCurrency(value: number) {
  return toEuroCurrency(value);
}

function TrendBars({ values }: { values: number[] }) {
  const normalized = values.map((value) => Math.max(0, value));
  const max = Math.max(...normalized, 1);

  return (
    <div className="flex h-8 items-end gap-1">
      {normalized.map((value, index) => (
        <div
          key={`${index}-${value}`}
          className="w-2 rounded-sm bg-primary/50"
          style={{ height: `${Math.max(15, Math.round((value / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

export function BusinessPerformanceWorkspace({
  entities,
  selectedEntityId,
  selectedEntityDetail,
  periodLabel
}: BusinessPerformanceWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [percentageInput, setPercentageInput] = useState("10");
  const [listSearch, setListSearch] = useState("");

  useEffect(() => {
    if (!entities.length) {
      setCheckedIds(new Set());
      return;
    }

    setCheckedIds((previous) => {
      const next = new Set(Array.from(previous).filter((id) => entities.some((entity) => entity.id === id)));
      if (next.size > 0) {
        return next;
      }

      if (selectedEntityId && entities.some((entity) => entity.id === selectedEntityId)) {
        next.add(selectedEntityId);
      }

      return next;
    });
  }, [entities, selectedEntityId]);

  const selectedForCalculator = useMemo(
    () => entities.filter((entity) => checkedIds.has(entity.id)),
    [entities, checkedIds]
  );

  const filteredEntities = useMemo(() => {
    const token = listSearch.trim().toLowerCase();

    if (!token) {
      return entities;
    }

    return entities.filter((entity) => {
      const name = entity.name.toLowerCase();
      const username = String(entity.username ?? "").toLowerCase();
      const email = String(entity.email ?? "").toLowerCase();
      return name.includes(token) || username.includes(token) || email.includes(token);
    });
  }, [entities, listSearch]);

  const baseCents = useMemo(
    () => selectedForCalculator.reduce((sum, entity) => sum + toCents(entity.periodMetrics.gmv), 0),
    [selectedForCalculator]
  );

  const parsedPercentage = Number(percentageInput);
  const hasValidPercentage = Number.isFinite(parsedPercentage) && parsedPercentage >= 0 && parsedPercentage <= 100;
  const commissionCents = hasValidPercentage ? calculateCommissionCents(baseCents, parsedPercentage) : 0;

  const calculatorError = (() => {
    if (!selectedForCalculator.length) {
      return "Select at least one entity to calculate commission.";
    }

    if (!hasValidPercentage) {
      return "Enter a valid percentage between 0 and 100.";
    }

    return null;
  })();

  const toggleChecked = (entityId: string, checked: boolean) => {
    setCheckedIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(entityId);
      } else {
        next.delete(entityId);
      }
      return next;
    });
  };

  const selectEntity = (entityId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("entity", entityId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Entities</p>
            <p className="text-xs text-text-muted">
              {filteredEntities.length} shown / {entities.length} loaded
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setIsCalculatorOpen(true)}>
            <Calculator size={14} />
            Calculate commission
          </Button>
        </div>

        <Input
          value={listSearch}
          onChange={(event) => setListSearch(event.target.value)}
          placeholder="Search this list by name, username or email"
        />

        {filteredEntities.length ? (
          <ul className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
            {filteredEntities.map((entity) => {
              const isSelected = entity.id === selectedEntityId;

              return (
                <li
                  key={entity.id}
                  className={cn(
                    "rounded-xl border p-3 transition",
                    isSelected ? "border-primary bg-[#eef4ff]" : "border-border bg-surface-elevated"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border"
                      checked={checkedIds.has(entity.id)}
                      onChange={(event) => toggleChecked(entity.id, event.target.checked)}
                      aria-label={`Select ${entity.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => selectEntity(entity.id)}
                      className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">{entity.name}</p>
                        <p className="truncate text-xs text-text-muted">{entity.email ?? entity.username ?? entity.id}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge color={entity.entityType === "hotel" ? "warning" : "info"}>{entity.entityType}</Badge>
                          {entity.assignedAgentName ? <Badge color="neutral">{entity.assignedAgentName}</Badge> : null}
                        </div>
                      </div>
                      <ChevronRight size={14} className={cn("mt-1 shrink-0 text-text-muted", isSelected ? "text-primary" : "")} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Revenue ({periodLabel})</p>
                      <p className="text-base font-semibold text-text">{formatCurrency(entity.periodMetrics.gmv)}</p>
                    </div>
                    <TrendBars values={entity.lastThreeMonthsGmv} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No entities found"
            description="Try another name/email search or adjust global filters."
          />
        )}
      </Card>

      <div className="space-y-4">
        {selectedEntityDetail ? (
          <>
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-text">{selectedEntityDetail.name}</h2>
                  <p className="text-sm text-text-muted">
                    {selectedEntityDetail.email ?? selectedEntityDetail.username ?? selectedEntityDetail.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={selectedEntityDetail.entityType === "hotel" ? "warning" : "info"}>
                    {selectedEntityDetail.entityType}
                  </Badge>
                  {selectedEntityDetail.assignedAgentName ? <Badge color="neutral">{selectedEntityDetail.assignedAgentName}</Badge> : null}
                </div>
              </div>

              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Total generated</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.gmv)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Attendi profit</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.attendiProfit)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Operations</p>
                  <p className="mt-2 text-xl font-semibold">{selectedEntityDetail.periodMetrics.operations}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Average ticket</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.averageTicket)}</p>
                </div>
              </section>

              <section className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Paid</p>
                  <p className="mt-1 font-semibold">{selectedEntityDetail.periodMetrics.paidOperations}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Refunded</p>
                  <p className="mt-1 font-semibold">{selectedEntityDetail.periodMetrics.refundedOperations}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Cancelled</p>
                  <p className="mt-1 font-semibold">{selectedEntityDetail.periodMetrics.cancelledOperations}</p>
                </div>
              </section>
            </Card>

            <Card className="space-y-4">
              <h3 className="text-sm font-semibold text-text">Monthly series (last 12 months)</h3>
              <div className="overflow-x-auto">
                <div className="flex min-w-[680px] items-end gap-2">
                  {(() => {
                    const max = Math.max(...selectedEntityDetail.monthlySeries.map((point) => point.metrics.gmv), 1);
                    return selectedEntityDetail.monthlySeries.map((point) => (
                      <div key={point.key} className="flex w-12 flex-col items-center gap-1">
                        <div
                          className="w-8 rounded-t-md bg-primary/60"
                          style={{ height: `${Math.max(8, Math.round((point.metrics.gmv / max) * 120))}px` }}
                          title={`${point.label}: ${formatCurrency(point.metrics.gmv)}`}
                        />
                        <p className="text-[10px] text-text-muted">{point.label}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <DataTable>
                <TableHeader>
                  <tr>
                    <TableHead>Month</TableHead>
                    <TableHead>GMV</TableHead>
                    <TableHead>Attendi Profit</TableHead>
                    <TableHead>Ops</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {selectedEntityDetail.monthlySeries.map((point) => (
                    <TableRow key={`series-${point.key}`}>
                      <TableCell>{point.label}</TableCell>
                      <TableCell>{formatCurrency(point.metrics.gmv)}</TableCell>
                      <TableCell>{formatCurrency(point.metrics.attendiProfit)}</TableCell>
                      <TableCell>{point.metrics.operations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </Card>

            <Card className="space-y-2">
              <h3 className="text-sm font-semibold text-text">Entity location</h3>
              {selectedEntityDetail.latitude !== null && selectedEntityDetail.longitude !== null ? (
                <div className="rounded-xl border border-border bg-surface-muted p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-text">
                    <MapPin size={14} />
                    {selectedEntityDetail.preciseLocation ?? "Coordinates available"}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {selectedEntityDetail.latitude.toFixed(6)}, {selectedEntityDetail.longitude.toFixed(6)}
                  </p>
                  <p className="mt-3 text-xs text-text-muted">
                    Map component is not present in this codebase yet; layout keeps this slot ready for map integration.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No coordinates available for this entity.</p>
              )}
            </Card>
          </>
        ) : (
          <Card>
            <EmptyState title="No entity selected" description="Select an entity from the left list to open monthly detail." />
          </Card>
        )}
      </div>

      {isCalculatorOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#081325]/55 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface-elevated p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-text">Calculate commission</h3>
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
                aria-label="Close commission calculator"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
              <label className="text-sm font-medium text-text">
                Percentage (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={percentageInput}
                  onChange={(event) => setPercentageInput(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm"
                />
              </label>
              <div className="rounded-xl border border-border bg-surface-muted p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Base ({periodLabel})</p>
                <p className="mt-1 text-xl font-semibold text-text">{formatCurrency(baseCents / 100)}</p>
                <p className="mt-2 text-xs text-text-muted">
                  Commission = Base * ({hasValidPercentage ? `${parsedPercentage}%` : "..."})
                </p>
                <p className="mt-1 text-sm font-semibold text-text">{formatCurrency(commissionCents / 100)}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
                <CheckSquare size={14} />
                Included entities
              </p>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-border bg-surface-muted p-3">
                {entities.map((entity) => (
                  <label key={`calc-${entity.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {entity.name}
                      <span className="ml-2 text-xs text-text-muted">({entity.entityType})</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-muted">{formatCurrency(entity.periodMetrics.gmv)}</span>
                      <input
                        type="checkbox"
                        checked={checkedIds.has(entity.id)}
                        onChange={(event) => toggleChecked(entity.id, event.target.checked)}
                        aria-label={`Include ${entity.name}`}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {calculatorError ? (
              <p className="mt-4 rounded-lg bg-[#fff1f1] px-3 py-2 text-sm text-danger">{calculatorError}</p>
            ) : null}

            <div className="mt-4">
              <DataTable>
                <TableHeader>
                  <tr>
                    <TableHead>Entity</TableHead>
                    <TableHead>Base GMV</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {selectedForCalculator.map((entity) => {
                    const entityBaseCents = toCents(entity.periodMetrics.gmv);
                    const entityCommission = hasValidPercentage
                      ? calculateCommissionCents(entityBaseCents, parsedPercentage)
                      : 0;

                    return (
                      <TableRow key={`calc-row-${entity.id}`}>
                        <TableCell>{entity.name}</TableCell>
                        <TableCell>{formatCurrency(entityBaseCents / 100)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entityCommission / 100)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-surface-muted/70">
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(baseCents / 100)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(commissionCents / 100)}</TableCell>
                  </TableRow>
                </TableBody>
              </DataTable>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
