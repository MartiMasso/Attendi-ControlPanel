"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calculator, CheckSquare, ChevronRight, Download, Maximize2, MapPin, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { calculateCommissionCents, toEuroCurrency } from "@/lib/business-performance";
import { cn } from "@/lib/utils";
import type { BusinessPerformanceEntityDetail, BusinessPerformanceEntityRow } from "@/types";

interface BusinessPerformanceWorkspaceProps {
  entities: BusinessPerformanceEntityRow[];
  selectedEntityId: string | null;
  selectedEntityDetail: BusinessPerformanceEntityDetail | null;
  periodLabel: string;
}

type CalculatorBase = "gmv_net" | "attendi_net" | "owner_gross";
type CalculatorPeriod = "current" | "last_3" | "last_6" | "last_12";

function toCents(value: number) {
  return Math.round(value * 100);
}

function formatCurrency(value: number) {
  return toEuroCurrency(value);
}

function formatCents(value: number) {
  return toEuroCurrency(value / 100);
}

function getAvatarInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "E";
  }

  return trimmed.charAt(0).toUpperCase();
}

function toBackgroundImage(url: string) {
  const safeUrl = url.replace(/"/g, "%22");
  return `url("${safeUrl}")`;
}

function renderHistoryTable(rows: BusinessPerformanceEntityDetail["history"]["rows"], expanded = false) {
  return (
    <DataTable>
      <TableHeader>
        <tr>
          <TableHead className="whitespace-nowrap">Date</TableHead>
          <TableHead className="whitespace-nowrap">Reservation ID</TableHead>
          <TableHead className="whitespace-nowrap">Customer Paid</TableHead>
          <TableHead className="whitespace-nowrap">Refunded</TableHead>
          <TableHead className="whitespace-nowrap">Owner</TableHead>
          <TableHead className="whitespace-nowrap">Hotel</TableHead>
          <TableHead className="whitespace-nowrap">Attendi Before Stripe</TableHead>
          <TableHead className="whitespace-nowrap">Stripe Fee</TableHead>
          <TableHead className="whitespace-nowrap">Attendi Net</TableHead>
          <TableHead className="whitespace-nowrap">Fee Source</TableHead>
          <TableHead className="whitespace-nowrap">Operation mode</TableHead>
          <TableHead className="whitespace-nowrap">Status</TableHead>
          {expanded ? (
            <>
              <TableHead className="whitespace-nowrap">Product</TableHead>
              <TableHead className="whitespace-nowrap">Window</TableHead>
              <TableHead className="whitespace-nowrap">Buyer ID</TableHead>
              <TableHead className="whitespace-nowrap">Reconciliation</TableHead>
            </>
          ) : null}
        </tr>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`ledger-${expanded ? "modal" : "inline"}-${row.reservationId}`}>
            <TableCell className="whitespace-nowrap">{row.effectiveAt ?? row.createdAt ?? "-"}</TableCell>
            <TableCell className="whitespace-nowrap">{row.reservationId}</TableCell>
            <TableCell className="whitespace-nowrap">{formatCents(row.grossCustomerCents)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatCents(row.refundedCustomerCents)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatCents(row.ownerAmountCents)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatCents(row.hotelAmountCents)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatCents(row.attendiAmountBeforeStripeCents)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatCents(row.stripeFeeCents)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatCents(row.attendiNetCents)}</TableCell>
            <TableCell className="whitespace-nowrap">
              {(row.feeSource ?? (row.isEstimated ? "estimated" : "real")) === "real" ? (
                <Badge color="success">real</Badge>
              ) : (
                <Badge color="warning">estimated</Badge>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">{row.operationMode ?? row.flowType}</TableCell>
            <TableCell className="whitespace-nowrap">{row.status ?? "-"}</TableCell>
            {expanded ? (
              <>
                <TableCell>{row.productTitle ?? row.productId ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.startDate ?? "-"} - {row.endDate ?? "-"}
                </TableCell>
                <TableCell className="whitespace-nowrap">{row.buyerUserId ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.ledgerStatus}</TableCell>
              </>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </DataTable>
  );
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

function getMetricBase(entity: BusinessPerformanceEntityRow, base: CalculatorBase, period: CalculatorPeriod) {
  const metrics = (() => {
    if (period === "last_3") return entity.trailingMetrics.last3Months;
    if (period === "last_6") return entity.trailingMetrics.last6Months;
    if (period === "last_12") return entity.trailingMetrics.last12Months;
    return entity.periodMetrics;
  })();

  if (base === "attendi_net") {
    return metrics.attendiNet;
  }

  if (base === "owner_gross") {
    return metrics.ownerEarnings;
  }

  return metrics.gmv;
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
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [percentageInput, setPercentageInput] = useState("10");
  const [listSearch, setListSearch] = useState("");
  const [calculatorBase, setCalculatorBase] = useState<CalculatorBase>("gmv_net");
  const [calculatorPeriod, setCalculatorPeriod] = useState<CalculatorPeriod>("current");

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
    () =>
      selectedForCalculator.reduce(
        (sum, entity) => sum + toCents(getMetricBase(entity, calculatorBase, calculatorPeriod)),
        0
      ),
    [selectedForCalculator, calculatorBase, calculatorPeriod]
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

  const updateSearchParams = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    router.push(`${pathname}?${params.toString()}`);
  };

  const selectEntity = (entityId: string) => {
    updateSearchParams((params) => {
      params.set("entity", entityId);
      params.set("historyPage", "1");
    });
  };

  const setHistoryFilter = (key: "historyStatus" | "historyProduct", value: string) => {
    updateSearchParams((params) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set("historyPage", "1");
    });
  };

  const setHistoryPage = (page: number) => {
    updateSearchParams((params) => {
      params.set("historyPage", String(Math.max(1, page)));
    });
  };

  const setHistoryPageSize = (size: string) => {
    updateSearchParams((params) => {
      params.set("historyPageSize", size);
      params.set("historyPage", "1");
    });
  };

  const historyStatus = searchParams.get("historyStatus") ?? "";
  const historyProduct = searchParams.get("historyProduct") ?? "";
  const exportHref = useMemo(() => {
    if (!selectedEntityDetail) {
      return "";
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("entity", selectedEntityDetail.id);
    return `/api/business-performance/entity-history/export?${params.toString()}`;
  }, [searchParams, selectedEntityDetail]);

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
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-[#eaf1ff] text-xs font-semibold text-primary">
                          {entity.profilePhotoUrl ? (
                            <div
                              className="h-full w-full bg-cover bg-center bg-no-repeat"
                              style={{ backgroundImage: toBackgroundImage(entity.profilePhotoUrl) }}
                              aria-hidden="true"
                            />
                          ) : (
                            <span>{getAvatarInitial(entity.name)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">{entity.name}</p>
                          <p className="truncate text-xs text-text-muted">{entity.email ?? entity.username ?? entity.id}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge color={entity.entityType === "hotel" ? "warning" : "info"}>{entity.entityType}</Badge>
                            {entity.assignedAgentName ? <Badge color="neutral">{entity.assignedAgentName}</Badge> : null}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} className={cn("mt-1 shrink-0 text-text-muted", isSelected ? "text-primary" : "")} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-text-muted">GMV Net ({periodLabel})</p>
                      <p className="text-base font-semibold text-text">{formatCurrency(entity.periodMetrics.gmv)}</p>
                      <p className="text-xs text-text-muted">Attendi Net: {formatCurrency(entity.periodMetrics.attendiNet)}</p>
                    </div>
                    <TrendBars values={entity.lastThreeMonthsGmv} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No entities found" description="Try another name/email search or adjust global filters." />
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
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">GMV Net</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.gmv)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Attendi Net</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.attendiNet)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Owner Earnings</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.ownerEarnings)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Hotel Attribution Earnings</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.hotelEarnings)}</p>
                </div>
              </section>

              <section className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Ops Total</p>
                  <p className="mt-1 font-semibold">{selectedEntityDetail.periodMetrics.operations}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Ops Cash</p>
                  <p className="mt-1 font-semibold">{selectedEntityDetail.periodMetrics.operationsWithCashMovement}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Refunds</p>
                  <p className="mt-1 font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.refunds)}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Average Ticket</p>
                  <p className="mt-1 font-semibold">{formatCurrency(selectedEntityDetail.periodMetrics.averageTicket)}</p>
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
                    <TableHead>GMV Net</TableHead>
                    <TableHead>Attendi Net</TableHead>
                    <TableHead>Ops</TableHead>
                    <TableHead>Ops Cash</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {selectedEntityDetail.monthlySeries.map((point) => (
                    <TableRow key={`series-${point.key}`}>
                      <TableCell>{point.label}</TableCell>
                      <TableCell>{formatCurrency(point.metrics.gmv)}</TableCell>
                      <TableCell>{formatCurrency(point.metrics.attendiNet)}</TableCell>
                      <TableCell>{point.metrics.operations}</TableCell>
                      <TableCell>{point.metrics.operationsWithCashMovement}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </Card>

            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-text">Operations ledger</h3>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setIsHistoryExpanded(true)}>
                    <Maximize2 size={14} />
                    Expand
                  </Button>
                  {exportHref ? (
                    <a
                      href={exportHref}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm font-medium text-text hover:bg-[#e7eefb]"
                    >
                      <Download size={14} />
                      Export CSV
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Select value={historyStatus} onChange={(event) => setHistoryFilter("historyStatus", event.target.value)}>
                  <option value="">All statuses</option>
                  <option value="pending">pending</option>
                  <option value="accepted">accepted</option>
                  <option value="confirmed">confirmed</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                  <option value="refunded">refunded</option>
                </Select>
                <Select value={historyProduct} onChange={(event) => setHistoryFilter("historyProduct", event.target.value)}>
                  <option value="">All products</option>
                  {selectedEntityDetail.historyProductOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                    </option>
                  ))}
                </Select>
                <Select
                  value={String(selectedEntityDetail.history.pageSize)}
                  onChange={(event) => setHistoryPageSize(event.target.value)}
                >
                  <option value="10">10 rows</option>
                  <option value="15">15 rows</option>
                  <option value="25">25 rows</option>
                  <option value="50">50 rows</option>
                </Select>
              </div>

              {selectedEntityDetail.history.rows.length ? (
                renderHistoryTable(selectedEntityDetail.history.rows, false)
              ) : (
                <EmptyState title="No history rows" description="No reservations match current history filters." />
              )}

              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
                <p className="text-text-muted">
                  Page {selectedEntityDetail.history.page} ({selectedEntityDetail.history.total} rows)
                </p>
                <div className="flex items-center gap-3">
                  {selectedEntityDetail.history.page > 1 ? (
                    <button className="font-medium text-primary hover:underline" onClick={() => setHistoryPage(selectedEntityDetail.history.page - 1)}>
                      Previous
                    </button>
                  ) : (
                    <span className="text-text-muted">Previous</span>
                  )}
                  {selectedEntityDetail.history.page * selectedEntityDetail.history.pageSize < selectedEntityDetail.history.total ? (
                    <button className="font-medium text-primary hover:underline" onClick={() => setHistoryPage(selectedEntityDetail.history.page + 1)}>
                      Next
                    </button>
                  ) : (
                    <span className="text-text-muted">Next</span>
                  )}
                </div>
              </div>
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
                </div>
              ) : (
                <p className="text-sm text-text-muted">No coordinates available for this entity.</p>
              )}
            </Card>
          </>
        ) : (
          <Card>
            <EmptyState title="No entity selected" description="Select an entity from the left list to open detail." />
          </Card>
        )}
      </div>

      {isHistoryExpanded && selectedEntityDetail ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#081325]/55 p-4">
          <div className="max-h-[92vh] w-full max-w-[96vw] overflow-hidden rounded-2xl border border-border bg-surface-elevated p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-text">Operations ledger (expanded)</h3>
                <p className="text-xs text-text-muted">
                  {selectedEntityDetail.name} · {selectedEntityDetail.history.total} rows (filtered)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryExpanded(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
                aria-label="Close expanded history"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 max-h-[78vh] overflow-auto">
              {selectedEntityDetail.history.rows.length ? (
                renderHistoryTable(selectedEntityDetail.history.rows, true)
              ) : (
                <EmptyState title="No history rows" description="No reservations match current history filters." />
              )}
            </div>
          </div>
        </div>
      ) : null}

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

            <div className="mt-4 grid gap-3 md:grid-cols-3">
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
              <label className="text-sm font-medium text-text">
                Base
                <Select value={calculatorBase} onChange={(event) => setCalculatorBase(event.target.value as CalculatorBase)}>
                  <option value="gmv_net">GMV net</option>
                  <option value="attendi_net">Attendi net</option>
                  <option value="owner_gross">Owner gross</option>
                </Select>
              </label>
              <label className="text-sm font-medium text-text">
                Period
                <Select value={calculatorPeriod} onChange={(event) => setCalculatorPeriod(event.target.value as CalculatorPeriod)}>
                  <option value="current">Current filtered period ({periodLabel})</option>
                  <option value="last_3">Last 3 months</option>
                  <option value="last_6">Last 6 months</option>
                  <option value="last_12">Last 12 months</option>
                </Select>
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-surface-muted p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Commission Base</p>
              <p className="mt-1 text-xl font-semibold text-text">{formatCurrency(baseCents / 100)}</p>
              <p className="mt-2 text-xs text-text-muted">
                Commission = Base * ({hasValidPercentage ? `${parsedPercentage}%` : "..."})
              </p>
              <p className="mt-1 text-sm font-semibold text-text">{formatCurrency(commissionCents / 100)}</p>
            </div>

            <div className="mt-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
                <CheckSquare size={14} />
                Included entities
              </p>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-border bg-surface-muted p-3">
                {entities.map((entity) => {
                  const entityBase = getMetricBase(entity, calculatorBase, calculatorPeriod);

                  return (
                    <label key={`calc-${entity.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {entity.name}
                        <span className="ml-2 text-xs text-text-muted">({entity.entityType})</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-muted">{formatCurrency(entityBase)}</span>
                        <input
                          type="checkbox"
                          checked={checkedIds.has(entity.id)}
                          onChange={(event) => toggleChecked(entity.id, event.target.checked)}
                          aria-label={`Include ${entity.name}`}
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {calculatorError ? <p className="mt-4 rounded-lg bg-[#fff1f1] px-3 py-2 text-sm text-danger">{calculatorError}</p> : null}

            <div className="mt-4">
              <DataTable>
                <TableHeader>
                  <tr>
                    <TableHead>Entity</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {selectedForCalculator.map((entity) => {
                    const entityBaseCents = toCents(getMetricBase(entity, calculatorBase, calculatorPeriod));
                    const entityCommission = hasValidPercentage ? calculateCommissionCents(entityBaseCents, parsedPercentage) : 0;

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
