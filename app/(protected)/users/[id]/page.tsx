import { notFound } from "next/navigation";

import { AddFlagForm } from "@/components/forms/add-flag-form";
import { AddNoteForm } from "@/components/forms/add-note-form";
import { UpdateAccountTypeForm } from "@/components/forms/update-account-type-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyValueList } from "@/components/ui/key-value-list";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { getUserDetail } from "@/services/users-service";

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const detail = await getUserDetail(params.id);

  if (!detail) {
    notFound();
  }

  const isHotel = detail.profile.account_type === "hotel";
  const businessDetails = (detail.businessDetails ?? {}) as Record<string, unknown>;
  const hotelCommission = detail.hotelCommissionOverview;
  const hotelRevenue = detail.hotelRevenueOverview;

  function toOptionalText(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  function formatPercent(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "-";
    }

    return `${value.toFixed(2)}%`;
  }

  function formatMoney(value: number | null | undefined, currency = "EUR") {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "-";
    }

    try {
      return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency
      }).format(value);
    } catch {
      return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR"
      }).format(value);
    }
  }

  function boolLabel(value: unknown) {
    if (typeof value !== "boolean") {
      return "-";
    }

    return value ? "Sí" : "No";
  }

  if (isHotel) {
    const contactEmail = toOptionalText(businessDetails.email) ?? detail.profile.email ?? "Not exposed";
    const locationParts = [
      toOptionalText(businessDetails.street),
      toOptionalText(businessDetails.street_number),
      toOptionalText(businessDetails.city),
      toOptionalText(businessDetails.postal_code)
    ].filter(Boolean);

    const mainItems = [
      { label: "Email de contacto", value: contactEmail },
      { label: "Username", value: detail.profile.username },
      { label: "Nombre visible", value: detail.profile.full_name ?? "-" },
      { label: "Tipo de cuenta", value: detail.profile.account_type },
      { label: "Verificación", value: <StatusBadge value={detail.profile.verification_status} /> },
      { label: "Empresa", value: toOptionalText(businessDetails.business_name) ?? "-" },
      { label: "NIF/CIF", value: toOptionalText(businessDetails.business_nif) ?? "-" },
      { label: "Teléfono", value: toOptionalText(businessDetails.phone) ?? "-" },
      { label: "Ubicación", value: locationParts.length ? locationParts.join(", ") : "-" },
      { label: "Creado", value: formatDate(detail.profile.created_at) },
      { label: "Última actividad", value: formatDate(detail.profile.last_seen_at) }
    ];

    const technicalItems = [
      { label: "User ID", value: detail.profile.id },
      { label: "Organization Type", value: toOptionalText(businessDetails.organization_type) ?? "-" },
      { label: "Company Type", value: toOptionalText(businessDetails.company_type) ?? "-" },
      { label: "Public Profile Slug", value: toOptionalText(businessDetails.public_profile_slug) ?? "-" },
      { label: "Hotel Display Name", value: toOptionalText(businessDetails.hotel_display_name) ?? "-" },
      { label: "Muestra catálogo propio", value: boolLabel(businessDetails.hotel_show_own_catalog) },
      { label: "Muestra ubicación pública", value: boolLabel(businessDetails.show_public_location) },
      { label: "Muestra email público", value: boolLabel(businessDetails.show_public_email) },
      { label: "Color de marca", value: toOptionalText(businessDetails.hotel_brand_color) ?? "-" },
      { label: "Verification Requested At", value: formatDate(toOptionalText(businessDetails.verification_requested_at)) },
      { label: "Verified At", value: formatDate(toOptionalText(businessDetails.verified_at)) },
      { label: "Rejected At", value: formatDate(toOptionalText(businessDetails.rejected_at)) },
      { label: "Rejection Reason", value: toOptionalText(businessDetails.rejection_reason) ?? "-" }
    ];

    return (
      <div className="space-y-6">
        <PageHeader
          title={detail.profile.full_name || detail.profile.username}
          description={`Hotel ID: ${detail.profile.id}`}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Comisión servicios propios</p>
            <p className="mt-2 text-2xl font-semibold text-text">{formatPercent(hotelCommission?.own_services_commission_pct)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Porción k sobre comisión empresa</p>
            <p className="mt-2 text-2xl font-semibold text-text">
              {hotelCommission ? `${hotelCommission.k_hotel.toFixed(2)} (${formatPercent(hotelCommission.k_hotel_pct)})` : "-"}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Total recibido por el hotel</p>
            <p className="mt-2 text-2xl font-semibold text-text">
              {formatMoney(hotelRevenue?.total_hotel_received, hotelRevenue?.currency ?? "EUR")}
            </p>
            <p className="mt-1 text-xs text-text-muted">{hotelRevenue?.operations ?? 0} operaciones atribuidas</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Ganancia generada para Attendi</p>
            <p className="mt-2 text-2xl font-semibold text-text">
              {formatMoney(hotelRevenue?.total_attendi_earned, hotelRevenue?.currency ?? "EUR")}
            </p>
            <p className="mt-1 text-xs text-text-muted">Suma de `attendi_amount` en atribuciones</p>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Empresas partner y comisión aplicada</h2>
          {(hotelCommission?.partners.length ?? 0) > 0 ? (
            <DataTable>
              <TableHeader>
                <tr>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Comisión efectiva</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Modo</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {hotelCommission?.partners.map((partner) => (
                  <TableRow key={partner.company_user_id}>
                    <TableCell>
                      <div className="font-medium">{partner.company_name}</div>
                      <div className="text-xs text-text-muted">{partner.company_user_id}</div>
                    </TableCell>
                    <TableCell>{partner.company_email ?? <span className="text-text-muted">Not exposed</span>}</TableCell>
                    <TableCell>{partner.account_type ?? "-"}</TableCell>
                    <TableCell>{formatPercent(partner.commission_effective_pct)}</TableCell>
                    <TableCell>
                      {partner.commission_mode === "custom" ? (
                        <span>
                          {formatPercent(partner.commission_override_pct)} personalizada (estándar {formatPercent(partner.commission_standard_pct)})
                        </span>
                      ) : (
                        <span>Estándar {formatPercent(partner.commission_standard_pct)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {partner.commission_mode === "custom" ? (
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
              title="Sin partners configurados"
              description="Este hotel no tiene empresas partner activas en `hotel_company_partners`."
            />
          )}
        </section>

        <details className="rounded-2xl border border-border bg-surface-elevated p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-text">Datos del perfil del hotel</summary>
          <div className="mt-4 space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-text">Datos principales</h3>
              <KeyValueList items={mainItems} />
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-text">Datos técnicos</h3>
              <KeyValueList items={technicalItems} />
            </section>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.profile.full_name || detail.profile.username}
        description={`User ID: ${detail.profile.id}`}
      />

      <KeyValueList
        items={[
          { label: "Email", value: detail.profile.email ?? "Not exposed" },
          { label: "Username", value: detail.profile.username },
          { label: "Account Type", value: detail.profile.account_type },
          { label: "Verification", value: <StatusBadge value={detail.profile.verification_status} /> },
          { label: "Created", value: formatDate(detail.profile.created_at) },
          { label: "Last Seen", value: formatDate(detail.profile.last_seen_at) }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Business details</h2>
          <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs text-text">
            {JSON.stringify(detail.businessDetails ?? {}, null, 2)}
          </pre>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Hotel details</h2>
          <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs text-text">
            {JSON.stringify(detail.hotelDetails ?? {}, null, 2)}
          </pre>
        </Card>
      </div>

      <section>
        <UpdateAccountTypeForm
          userId={detail.profile.id}
          currentAccountType={detail.profile.account_type}
          currentVerificationStatus={detail.profile.verification_status}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Related products</h2>
          {detail.products.length ? (
            <DataTable>
              <TableHeader>
                <tr>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Created</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {detail.products.map((product) => (
                  <TableRow key={String(product.id)}>
                    <TableCell>{String(product.title ?? "-")}</TableCell>
                    <TableCell>{String(product.category ?? "-")}</TableCell>
                    <TableCell>{formatDate(String(product.created_at ?? ""))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <EmptyState title="No products" description="This user has no related products in the current schema." />
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Related reservations</h2>
          {detail.reservations.length ? (
            <DataTable>
              <TableHeader>
                <tr>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Range</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {detail.reservations.map((reservation) => (
                  <TableRow key={String(reservation.id)}>
                    <TableCell>{String(reservation.id)}</TableCell>
                    <TableCell>
                      <StatusBadge value={String(reservation.status ?? "unknown")} />
                    </TableCell>
                    <TableCell>
                      {String(reservation.start_date ?? "-")} - {String(reservation.end_date ?? "-")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <EmptyState title="No reservations" description="No reservations are linked to this user yet." />
          )}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AddNoteForm entityType="user" entityId={detail.profile.id} />
        <AddFlagForm entityType="user" entityId={detail.profile.id} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Admin notes</h2>
          {detail.notes.length ? (
            <ul className="space-y-2 text-sm">
              {detail.notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-border bg-surface-muted p-3">
                  <p className="text-text">{note.note}</p>
                  <p className="mt-1 text-xs text-text-muted">{formatDate(note.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No admin notes yet.</p>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Internal flags</h2>
          {detail.flags.length ? (
            <ul className="space-y-2 text-sm">
              {detail.flags.map((flag) => (
                <li key={flag.id} className="rounded-lg border border-border bg-surface-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text">{flag.flag_type}</span>
                    <StatusBadge value={flag.severity} />
                  </div>
                  <p className="mt-1 text-text-muted">{flag.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No flags for this user.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
