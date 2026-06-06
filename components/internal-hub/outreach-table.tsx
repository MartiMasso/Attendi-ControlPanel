"use client";

import { Calendar, ChevronDown, ChevronRight, Mail, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  COMPANY_PRIORITIES,
  formatEmailDate,
  priorityDotClass,
  type OutreachContact
} from "@/components/internal-hub/outreach-shared";

interface OutreachTableProps {
  contacts: OutreachContact[];
  onPatch: (id: string, patch: Partial<OutreachContact>, persist: boolean) => void;
  onDelete: (id: string) => void;
  onComposeEmail: (contact: OutreachContact) => void;
}

const headerClass = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted";
const cellClass = "border-b border-border px-2 py-1.5 align-middle";
const inputClass = "h-9 border-transparent bg-transparent shadow-none focus:border-primary focus:bg-surface-elevated";
const detailLabelClass = "mb-1 block text-xs font-medium text-text-muted";

export function OutreachTable({ contacts, onPatch, onDelete, onComposeEmail }: OutreachTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleContact(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead className="bg-surface-muted/50">
          <tr>
            <th className={cn(headerClass, "min-w-[200px]")}>Nombre</th>
            <th className={cn(headerClass, "min-w-[220px]")}>Email</th>
            <th className={cn(headerClass, "min-w-[150px]")}>Teléfono</th>
            <th className={cn(headerClass, "min-w-[150px]")}>Último Email</th>
            <th className={cn(headerClass, "min-w-[150px]")} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const isExpanded = expandedIds.has(contact.id);
            const ExpandIcon = isExpanded ? ChevronDown : ChevronRight;

            return (
              <Fragment key={contact.id}>
                <tr className="transition hover:bg-surface-muted/30">
                  <td className={cellClass}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleContact(contact.id)}
                        className="rounded-md p-1 text-text-muted transition hover:bg-surface-muted hover:text-text"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Ocultar" : "Mostrar"} detalles de ${contact.companyName || "contacto"}`}
                        title={isExpanded ? "Ocultar detalles" : "Mostrar detalles"}
                      >
                        <ExpandIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span
                        className={cn("h-2.5 w-2.5 shrink-0 rounded-full", priorityDotClass[contact.priority])}
                        title={`Importancia: ${contact.priority}`}
                        aria-label={`Importancia: ${contact.priority}`}
                      />
                      <Input
                        value={contact.companyName}
                        placeholder="Nombre"
                        className={cn(inputClass, "min-w-0")}
                        onChange={(event) => onPatch(contact.id, { companyName: event.target.value }, false)}
                        onBlur={() => onPatch(contact.id, { companyName: contact.companyName }, true)}
                      />
                    </div>
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
                    <div className="inline-flex items-center gap-2 px-3 py-2 text-sm text-text">
                      <Calendar className="h-4 w-4 text-text-muted" aria-hidden="true" />
                      <span>{formatEmailDate(contact.lastEmailAt)}</span>
                    </div>
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
                {isExpanded ? (
                  <tr>
                    <td colSpan={5} className="border-b border-border bg-surface-muted/20 px-4 py-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className={detailLabelClass}>Nombre de contacto</label>
                          <Input
                            value={contact.contactName}
                            placeholder="Persona de contacto"
                            onChange={(event) => onPatch(contact.id, { contactName: event.target.value }, false)}
                            onBlur={() => onPatch(contact.id, { contactName: contact.contactName }, true)}
                          />
                        </div>
                        <div>
                          <label className={detailLabelClass}>Importancia</label>
                          <Select
                            value={contact.priority}
                            onChange={(event) => onPatch(contact.id, { priority: event.target.value as OutreachContact["priority"] }, true)}
                          >
                            {COMPANY_PRIORITIES.map((priority) => (
                              <option key={priority} value={priority}>
                                {priority}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className={detailLabelClass}>Localización</label>
                          <Input
                            value={contact.location}
                            placeholder="Ciudad, zona o dirección"
                            onChange={(event) => onPatch(contact.id, { location: event.target.value }, false)}
                            onBlur={() => onPatch(contact.id, { location: contact.location }, true)}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
