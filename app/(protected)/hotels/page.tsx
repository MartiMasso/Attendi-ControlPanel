import Link from "next/link";
import {
  BadgeEuro,
  Building2,
  CheckCircle2,
  CircleAlert,
  MapPin,
  QrCode,
  Search,
  Store,
  WalletCards
} from "lucide-react";

import { HotelPartnerCommissionForm, HotelSplitCommissionForm } from "@/components/forms/commission-settings-forms";
import { Badge } from "@/components/ui/badge";
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
    location?: string;
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

function compactId(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatCoordinate(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(5);
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

function buildHotelHref(query: string, hotelId: string, locationId?: string | null) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  params.set("hotel", hotelId);

  if (locationId) {
    params.set("location", locationId);
  }

  return `/hotels?${params.toString()}`;
}

function getStripeBadge(hotel: {
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  stripe_transfers_enabled: boolean;
}) {
  if (!hotel.stripe_account_id) {
    return <Badge color="warning">Sin Stripe</Badge>;
  }

  if (hotel.charges_enabled && hotel.payouts_enabled && hotel.stripe_transfers_enabled) {
    return <Badge color="success">Stripe operativo</Badge>;
  }

  return <Badge color="warning">Stripe incompleto</Badge>;
}

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const query = firstParam(searchParams.q) ?? "";
  const hotel = firstParam(searchParams.hotel) ?? "";
  const location = firstParam(searchParams.location) ?? "";

  let data: Awaited<ReturnType<typeof getHotelsCommissionDirectory>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getHotelsCommissionDirectory({
      query,
      selectedHotelId: hotel,
      selectedLocationId: location
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load Hotels section.";
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Hotels"
          description="Gestiona cuentas de hotel, localizaciones y el reparto de comisiones con empresas partner."
        />
        <ErrorState message={loadError ?? "Unknown error loading Hotels section."} />
      </div>
    );
  }

  const selectedHotel = data.selectedHotel;
  const selectedLocation = selectedHotel?.selectedLocation ?? null;
  const locationNameById = new Map(
    (selectedHotel?.locations ?? [])
      .filter((hotelLocation) => hotelLocation.id)
      .map((hotelLocation) => [hotelLocation.id as string, hotelLocation.name])
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hotels"
        description="Gestiona cuentas de hotel con múltiples localizaciones, Stripe compartido y partners por subperfil."
        rightSlot={(
          <>
            <Badge color="info">{data.totals.hotel_accounts} cuentas</Badge>
            <Badge color="neutral">{data.totals.active_locations} localizaciones activas</Badge>
          </>
        )}
      />

      <form
        className="rounded-xl border border-border bg-surface-elevated p-3 shadow-card"
        method="GET"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input
              name="q"
              defaultValue={data.query}
              placeholder="Buscar por cuenta, localización, email o ID"
              className="pl-9"
            />
          </div>
          {data.selectedHotelId ? <input type="hidden" name="hotel" value={data.selectedHotelId} /> : null}
          {data.selectedLocationId ? <input type="hidden" name="location" value={data.selectedLocationId} /> : null}
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-strong"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Filtrar
          </button>
        </div>
      </form>

      <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-text">Cuentas hoteleras</h2>
              <p className="text-xs text-text-muted">{data.totals.hotel_locations} subperfiles cargados</p>
            </div>
            <Badge color="neutral">{data.hotels.length} visibles</Badge>
          </div>

          {data.hotels.length ? (
            <div className="max-h-[72vh] divide-y divide-border overflow-y-auto">
              {data.hotels.map((row) => {
                const active = row.id === data.selectedHotelId;

                return (
                  <Link
                    key={row.id}
                    href={buildHotelHref(data.query, row.id)}
                    className={cn(
                      "block px-4 py-4 transition",
                      active ? "bg-[#eef5ff]" : "hover:bg-[#f8fbff]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-[#eaf1ff] text-sm font-semibold text-primary">
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-text">{row.name}</div>
                            <div className="truncate text-xs text-text-muted">{row.email ?? row.username ?? compactId(row.id)}</div>
                          </div>
                          {active ? <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" /> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge color="neutral">{row.active_locations_count}/{row.locations_count} locales</Badge>
                          <Badge color="neutral">k {formatPercent(row.k_hotel_pct)}</Badge>
                          {getStripeBadge(row)}
                        </div>
                        {row.primary_location_name ? (
                          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{row.primary_location_name}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm text-text-muted">No se han encontrado hoteles con los filtros actuales.</p>
            </div>
          )}
        </aside>

        {selectedHotel ? (
          <div className="space-y-5">
            <section className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-card">
              <div
                className="h-2 bg-primary"
                style={selectedLocation?.brand_color ? { backgroundColor: selectedLocation.brand_color } : undefined}
                aria-hidden="true"
              />
              <div className="space-y-5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-[#eaf1ff] text-base font-semibold text-primary">
                      {selectedHotel.profile_photo_url ? (
                        <div
                          className="h-full w-full bg-cover bg-center bg-no-repeat"
                          style={{ backgroundImage: toBackgroundImage(selectedHotel.profile_photo_url) }}
                          aria-hidden="true"
                        />
                      ) : (
                        <span>{getAvatarInitial(selectedHotel.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold text-text">{selectedHotel.name}</h2>
                      <p className="truncate text-sm text-text-muted">{selectedHotel.email ?? selectedHotel.username ?? selectedHotel.id}</p>
                      <p className="mt-1 text-xs text-text-muted">Hotel ID: {compactId(selectedHotel.id)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {getStripeBadge(selectedHotel)}
                    <Badge color="neutral">Creado: {formatDate(selectedHotel.created_at)}</Badge>
                  </div>
                </div>

                <div className="grid overflow-hidden rounded-lg border border-border md:grid-cols-4">
                  <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-text-muted">
                      <WalletCards className="h-4 w-4" aria-hidden="true" />
                      Stripe común
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-text">{compactId(selectedHotel.stripe_account_id)}</p>
                  </div>
                  <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-text-muted">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      Subperfiles
                    </div>
                    <p className="mt-2 text-sm font-semibold text-text">
                      {selectedHotel.active_locations_count} activos de {selectedHotel.locations_count}
                    </p>
                  </div>
                  <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-text-muted">
                      <BadgeEuro className="h-4 w-4" aria-hidden="true" />
                      k hotel
                    </div>
                    <p className="mt-2 text-sm font-semibold text-text">{selectedLocation ? formatPercent(selectedLocation.k_hotel_pct) : "-"}</p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-text-muted">
                      <Store className="h-4 w-4" aria-hidden="true" />
                      Partners
                    </div>
                    <p className="mt-2 text-sm font-semibold text-text">{selectedLocation ? selectedLocation.partners.length : 0} en la localización</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface-elevated shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-start gap-2">
                  <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold text-text">QR y código del hotel</h3>
                    <p className="text-xs text-text-muted">
                      Los huéspedes escanean el QR o introducen el código para vincularse a este hotel.
                    </p>
                  </div>
                </div>
                <Badge color="info">
                  {selectedHotel.referral_codes.length}{" "}
                  {selectedHotel.referral_codes.length === 1 ? "código" : "códigos"}
                </Badge>
              </div>

              {selectedHotel.referral_codes.length ? (
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  {selectedHotel.referral_codes.map((referral) => {
                    const locationLabel = referral.hotel_location_id
                      ? locationNameById.get(referral.hotel_location_id) ?? "Localización"
                      : "Toda la cuenta";

                    return (
                      <div key={referral.code} className="flex gap-4 rounded-lg border border-border bg-white p-4">
                        {referral.qr_data_url ? (
                          <div
                            className="h-28 w-28 shrink-0 rounded-md border border-border bg-white bg-contain bg-center bg-no-repeat"
                            style={{ backgroundImage: toBackgroundImage(referral.qr_data_url) }}
                            role="img"
                            aria-label={`QR del código ${referral.code}`}
                          />
                        ) : (
                          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-text-muted">
                            <QrCode className="h-8 w-8" aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-lg font-semibold tracking-wide text-text">{referral.code}</span>
                            <Badge color={referral.active ? "success" : "neutral"}>
                              {referral.active ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{locationLabel}</span>
                          </p>
                          <dl className="mt-3 space-y-1 text-xs text-text-muted">
                            <div className="flex justify-between gap-2">
                              <dt>Usos</dt>
                              <dd className="font-medium text-text">
                                {referral.activations_count}
                                {referral.max_activations !== null ? ` / ${referral.max_activations}` : ""}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt>Caduca</dt>
                              <dd className="font-medium text-text">
                                {referral.expires_at ? formatDate(referral.expires_at) : "Sin caducidad"}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="Sin código de invitación"
                    description="Este hotel todavía no tiene ningún código en hotel_referral_codes."
                  />
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface-elevated shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-text">Localizaciones</h3>
                  <p className="text-xs text-text-muted">Cada subperfil puede tener partners, filtros y comisiones propios.</p>
                </div>
                <Badge color="info">{selectedHotel.locations.length} subperfiles</Badge>
              </div>

              {selectedHotel.locations.length ? (
                <div className="grid gap-3 p-4 lg:grid-cols-2">
                  {selectedHotel.locations.map((hotelLocation) => {
                    const active = hotelLocation.location_key === data.selectedLocationId;

                    return (
                      <Link
                        key={hotelLocation.location_key}
                        href={buildHotelHref(data.query, selectedHotel.id, hotelLocation.location_key)}
                        className={cn(
                          "rounded-lg border p-4 transition",
                          active
                            ? "border-primary bg-[#eef5ff]"
                            : "border-border bg-white hover:border-primary/40 hover:bg-[#f8fbff]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <h4 className="truncate text-sm font-semibold text-text">{hotelLocation.name}</h4>
                              {hotelLocation.is_primary ? <Badge color="info">Principal</Badge> : null}
                            </div>
                            <p className="mt-1 truncate text-xs text-text-muted">{hotelLocation.address ?? "Sin dirección pública"}</p>
                          </div>
                          {hotelLocation.active ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Activa" />
                          ) : (
                            <CircleAlert className="h-4 w-4 shrink-0 text-warning" aria-label="Inactiva" />
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge color="neutral">k {formatPercent(hotelLocation.k_hotel_pct)}</Badge>
                          <Badge color={hotelLocation.show_own_catalog ? "success" : "neutral"}>
                            {hotelLocation.show_own_catalog ? "Catálogo propio" : "Sin catálogo propio"}
                          </Badge>
                          <Badge color="neutral">{compactId(hotelLocation.id)}</Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="Sin localizaciones"
                    description="Esta cuenta de hotel todavía no tiene subperfiles registrados."
                  />
                </div>
              )}
            </section>

            {selectedLocation ? (
              <>
                <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-text-muted">Localización seleccionada</p>
                        <h3 className="mt-1 truncate text-lg font-semibold text-text">{selectedLocation.name}</h3>
                        <p className="mt-1 text-sm text-text-muted">{selectedLocation.address ?? "Sin dirección pública"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedLocation.is_primary ? <Badge color="info">Principal</Badge> : null}
                        <Badge color={selectedLocation.active ? "success" : "warning"}>{selectedLocation.active ? "Activa" : "Inactiva"}</Badge>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-surface-muted p-3">
                        <p className="text-xs font-semibold uppercase text-text-muted">Contacto público</p>
                        <p className="mt-1 truncate text-sm text-text">{selectedLocation.public_email ?? "Sin email público"}</p>
                        <p className="truncate text-xs text-text-muted">{selectedLocation.public_phone ?? "Sin teléfono público"}</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted p-3">
                        <p className="text-xs font-semibold uppercase text-text-muted">Coordenadas</p>
                        <p className="mt-1 text-sm text-text">
                          {formatCoordinate(selectedLocation.latitude)}, {formatCoordinate(selectedLocation.longitude)}
                        </p>
                        <p className="text-xs text-text-muted">Usadas para partners por proximidad</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-card">
                    <p className="text-xs font-semibold uppercase text-text-muted">Reparto de comisión</p>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-text-muted">CE_p</p>
                        <p className="mt-1 text-lg font-semibold text-text">{formatPercent(selectedLocation.standard_ce_p_pct)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Hotel</p>
                        <p className="mt-1 text-lg font-semibold text-text">{formatPercent(selectedLocation.standard_hotel_pct)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Attendi</p>
                        <p className="mt-1 text-lg font-semibold text-text">{formatPercent(selectedLocation.standard_attendi_pct)}</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-[#f8fbff] p-3 text-xs text-text-muted">
                      % hotel = CE_p x k_hotel. Los overrides por empresa se aplican primero a esta localización y después a la cuenta.
                    </div>
                    <HotelSplitCommissionForm
                      hotelId={selectedHotel.id}
                      currentKHotelPct={selectedLocation.k_hotel_pct}
                      referenceCePPct={selectedLocation.standard_ce_p_pct}
                      className="mt-4 bg-white"
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text">Empresas partner de {selectedLocation.name}</h3>
                      <p className="text-xs text-text-muted">Comisión efectiva calculada para el subperfil seleccionado.</p>
                    </div>
                    <Badge color="info">{selectedLocation.partners.length} partners</Badge>
                  </div>

                  {selectedLocation.partners.length ? (
                    <DataTable>
                      <TableHeader>
                        <tr>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>CE_p efectiva</TableHead>
                          <TableHead>Reparto</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Ajustar comisión</TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {selectedLocation.partners.map((partner) => {
                          const hotelPct = partner.ce_p_effective_pct * partner.k_hotel;
                          const attendiPct = partner.ce_p_effective_pct * (1 - partner.k_hotel);

                          return (
                            <TableRow key={`${selectedLocation.location_key}-${partner.company_id}`}>
                              <TableCell>
                                <div className="font-medium">{partner.company_name}</div>
                                <div className="text-xs text-text-muted">{compactId(partner.company_id)}</div>
                              </TableCell>
                              <TableCell>{partner.company_email ?? <span className="text-text-muted">No expuesto</span>}</TableCell>
                              <TableCell>
                                <div className="font-semibold">{formatPercent(partner.ce_p_effective_pct)}</div>
                                <div className="text-xs text-text-muted">Base {formatPercent(partner.ce_p_standard_pct)}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">Hotel {formatPercent(hotelPct)}</div>
                                <div className="text-xs text-text-muted">Attendi {formatPercent(attendiPct)}</div>
                              </TableCell>
                              <TableCell>
                                {partner.visible_products_count === null ? (
                                  <span className="text-text-muted">-</span>
                                ) : (
                                  partner.visible_products_count
                                )}
                              </TableCell>
                              <TableCell>
                                {partner.has_custom_ce_p ? (
                                  <Badge color="info">Personalizada</Badge>
                                ) : (
                                  <Badge color="neutral">Estándar</Badge>
                                )}
                                {partner.has_custom_k_hotel ? (
                                  <div className="mt-1">
                                    <Badge color="info">k propia</Badge>
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <HotelPartnerCommissionForm
                                  hotelId={selectedHotel.id}
                                  locationId={selectedLocation.id}
                                  companyId={partner.company_id}
                                  currentEffectivePct={partner.ce_p_effective_pct}
                                  standardPct={partner.ce_p_standard_pct}
                                  hasCustom={partner.has_custom_ce_p}
                                  currentKHotelPct={partner.k_hotel_pct}
                                  defaultKHotelPct={selectedLocation.k_hotel_pct}
                                  compact
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </DataTable>
                  ) : (
                    <EmptyState
                      title="Sin partners para esta localización"
                      description="No hay empresas activas derivadas de sus filtros, coordenadas o enlaces legacy."
                    />
                  )}
                </section>
              </>
            ) : (
              <EmptyState
                title="No hay localización seleccionada"
                description="Selecciona un subperfil del hotel para ver partners y reparto de comisión."
              />
            )}
          </div>
        ) : (
          <EmptyState
            title="No hay hotel seleccionado"
            description="Selecciona una cuenta hotelera del listado para ver sus localizaciones y partners."
          />
        )}
      </section>
    </div>
  );
}
