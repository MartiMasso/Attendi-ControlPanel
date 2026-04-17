import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, cn } from "@/lib/utils";
import { getHotelsCommissionDirectory } from "@/services/hotels-service";

interface HotelsPageProps {
  searchParams: {
    q?: string;
    hotel?: string;
  };
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${value.toFixed(2)}%`;
}

function getAvatarInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "H";
  }

  return trimmed.charAt(0).toUpperCase();
}

function toBackgroundImage(url: string) {
  const safeUrl = url.replace(/"/g, "%22");
  return `url("${safeUrl}")`;
}

function buildHotelHref(query: string, hotelId: string) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  params.set("hotel", hotelId);
  return `/hotels?${params.toString()}`;
}

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const query = firstParam(searchParams.q) ?? "";
  const hotel = firstParam(searchParams.hotel) ?? "";

  let data: Awaited<ReturnType<typeof getHotelsCommissionDirectory>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getHotelsCommissionDirectory({
      query,
      selectedHotelId: hotel
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load Hotels section.";
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Hotels"
          description="Consulta perfiles de hotel y el reparto de comisiones con sus empresas partner."
        />
        <ErrorState message={loadError ?? "Unknown error loading Hotels section."} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hotels"
        description="Consulta perfiles de hotel y el reparto de comisiones con sus empresas partner."
        rightSlot={<Badge color="info">{data.hotels.length} hotels</Badge>}
      />

      <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-[minmax(0,1fr)_auto]" method="GET">
        <Input
          name="q"
          defaultValue={data.query}
          placeholder="Search by hotel name, username or ID"
        />
        {data.selectedHotelId ? <input type="hidden" name="hotel" value={data.selectedHotelId} /> : null}
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-strong"
        >
          Apply filters
        </button>
      </form>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Perfiles de hotel</h2>
            <span className="text-xs text-text-muted">{data.hotels.length} loaded</span>
          </div>

          {data.hotels.length ? (
            <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {data.hotels.map((row) => {
                const active = row.id === data.selectedHotelId;

                return (
                  <Link
                    key={row.id}
                    href={buildHotelHref(data.query, row.id)}
                    className={cn(
                      "block rounded-xl border px-3 py-3 transition",
                      active
                        ? "border-primary bg-[#edf4ff]"
                        : "border-border bg-surface-elevated hover:border-primary/40 hover:bg-[#f8fbff]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-[#eaf1ff] text-sm font-semibold text-primary">
                        {row.profile_photo_url ? (
                          <div
                            className="h-full w-full bg-cover bg-center bg-no-repeat"
                            style={{ backgroundImage: toBackgroundImage(row.profile_photo_url) }}
                            aria-hidden="true"
                          />
                        ) : (
                          <span>{getAvatarInitial(row.name)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-text">{row.name}</div>
                        <div className="truncate text-xs text-text-muted">{row.email ?? row.username ?? row.id}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge color="neutral">k_hotel {formatPercent(row.k_hotel_pct)}</Badge>
                      <Badge color="neutral">{row.partners_count} partners</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No se han encontrado hoteles con los filtros actuales.</p>
          )}
        </Card>

        {data.selectedHotel ? (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text">{data.selectedHotel.name}</h2>
                  <p className="text-sm text-text-muted">{data.selectedHotel.email ?? data.selectedHotel.username ?? data.selectedHotel.id}</p>
                  <p className="mt-1 text-xs text-text-muted">Hotel ID: {data.selectedHotel.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge color="info">{data.selectedHotel.partners.length} partner companies</Badge>
                  <Badge color="neutral">Creado: {formatDate(data.selectedHotel.created_at)}</Badge>
                </div>
              </div>

              <section className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">k_hotel</p>
                  <p className="mt-1 text-xl font-semibold text-text">
                    {data.selectedHotel.k_hotel.toFixed(2)} ({formatPercent(data.selectedHotel.k_hotel_pct)})
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">CE_p estándar</p>
                  <p className="mt-1 text-xl font-semibold text-text">{formatPercent(data.selectedHotel.standard_ce_p_pct)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Reparto estándar</p>
                  <p className="mt-1 text-sm text-text">
                    Hotel {formatPercent(data.selectedHotel.standard_hotel_pct)} | Attendi {formatPercent(data.selectedHotel.standard_attendi_pct)}
                  </p>
                </div>
              </section>

              <p className="text-xs text-text-muted">
                Fórmula aplicada por partner: <strong>% hotel = CE_p × k_hotel</strong> y <strong>% Attendi = CE_p × (1 - k_hotel)</strong>.
                CE_p estándar de referencia en panel: {formatPercent(data.default_standard_commission_pct)}.
              </p>
            </Card>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-text">Empresas partner y comisión</h3>
              {data.selectedHotel.partners.length ? (
                <DataTable>
                  <TableHeader>
                    <tr>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>CE_p efectiva</TableHead>
                      <TableHead>Estado</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {data.selectedHotel.partners.map((partner) => (
                      <TableRow key={`${data.selectedHotelId}-${partner.company_id}`}>
                        <TableCell>
                          <div className="font-medium">{partner.company_name}</div>
                          <div className="text-xs text-text-muted">{partner.company_id}</div>
                        </TableCell>
                        <TableCell>{partner.company_email ?? <span className="text-text-muted">Not exposed</span>}</TableCell>
                        <TableCell>{formatPercent(partner.ce_p_effective_pct)}</TableCell>
                        <TableCell>
                          {partner.has_custom_ce_p ? (
                            <Badge color="info">Personalizada</Badge>
                          ) : (
                            <Badge color="neutral">Estándar</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              ) : (
                <EmptyState
                  title="Sin partners activos"
                  description="No hay empresas recomendadas activas para este hotel según sus filtros de recomendación."
                />
              )}
            </section>
          </div>
        ) : (
          <EmptyState
            title="No hay hotel seleccionado"
            description="Selecciona un hotel del listado para ver empresas partner y reparto de comisión."
          />
        )}
      </section>
    </div>
  );
}
