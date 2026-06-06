"use client";

import { Mail, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OutreachContact } from "@/components/internal-hub/outreach-shared";

interface OutreachTableProps {
  contacts: OutreachContact[];
  onPatch: (id: string, patch: Partial<OutreachContact>, persist: boolean) => void;
  onDelete: (id: string) => void;
  onComposeEmail: (contact: OutreachContact) => void;
}

const headerClass = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted";
const cellClass = "border-b border-border px-2 py-1.5 align-middle";
const inputClass = "h-9 border-transparent bg-transparent shadow-none focus:border-primary focus:bg-surface-elevated";

export function OutreachTable({ contacts, onPatch, onDelete, onComposeEmail }: OutreachTableProps) {
  if (!contacts.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-6 py-12 text-center">
        <p className="text-sm font-medium text-text">Todavía no hay contactos en esta lista</p>
        <p className="mt-1 text-xs text-text-muted">Usa el botón “Añadir” para crear el primero.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated shadow-card">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-surface-muted/50">
          <tr>
            <th className={cn(headerClass, "min-w-[200px]")}>Nombre</th>
            <th className={cn(headerClass, "min-w-[220px]")}>Email</th>
            <th className={cn(headerClass, "min-w-[150px]")}>Teléfono</th>
            <th className={cn(headerClass, "min-w-[150px]")}>Fecha demo</th>
            <th className={cn(headerClass, "min-w-[150px]")} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="transition hover:bg-surface-muted/30">
              <td className={cellClass}>
                <Input
                  value={contact.companyName}
                  placeholder="Nombre"
                  className={inputClass}
                  onChange={(event) => onPatch(contact.id, { companyName: event.target.value }, false)}
                  onBlur={() => onPatch(contact.id, { companyName: contact.companyName }, true)}
                />
              </td>
              <td className={cellClass}>
                <Input
                  type="email"
                  value={contact.email}
                  placeholder="email@empresa.com"
                  className={inputClass}
                  onChange={(event) => onPatch(contact.id, { email: event.target.value }, false)}
                  onBlur={() => onPatch(contact.id, { email: contact.email }, true)}
                />
              </td>
              <td className={cellClass}>
                <Input
                  value={contact.phone}
                  placeholder="—"
                  className={inputClass}
                  onChange={(event) => onPatch(contact.id, { phone: event.target.value }, false)}
                  onBlur={() => onPatch(contact.id, { phone: contact.phone }, true)}
                />
              </td>
              <td className={cellClass}>
                <Input
                  type="date"
                  value={contact.followUpDate}
                  aria-label="Fecha demo"
                  className={inputClass}
                  onChange={(event) => onPatch(contact.id, { followUpDate: event.target.value }, true)}
                />
              </td>
              <td className={cn(cellClass, "whitespace-nowrap")}>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onComposeEmail(contact)}
                    disabled={!contact.email.trim()}
                    title={contact.email.trim() ? "Redactar email" : "Añade un email primero"}
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Enviar Email
                  </Button>
                  <button
                    type="button"
                    onClick={() => onDelete(contact.id)}
                    className="rounded-md p-1.5 text-text-muted transition hover:bg-rose-50 hover:text-danger"
                    aria-label={`Eliminar ${contact.companyName || "contacto"}`}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
