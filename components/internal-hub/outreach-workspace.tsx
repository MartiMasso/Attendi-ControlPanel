"use client";

import { BedDouble, Building2, CheckCircle2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OutreachEmailModal } from "@/components/internal-hub/outreach-email-modal";
import { OutreachPendingStrip } from "@/components/internal-hub/outreach-pending-strip";
import { OutreachTable } from "@/components/internal-hub/outreach-table";
import {
  contactFromRow,
  createContactRequest,
  deleteContactRequest,
  LIST_META,
  patchContactRequest,
  type OutreachContact
} from "@/components/internal-hub/outreach-shared";
import type { InternalCompanyContactRow, InternalCompanyListType } from "@/types";

interface OutreachWorkspaceProps {
  initialContacts: InternalCompanyContactRow[];
  gmailAccount: { email: string } | null;
}

const LIST_TABS: Array<{ value: InternalCompanyListType; icon: typeof Building2 }> = [
  { value: "empresa", icon: Building2 },
  { value: "alojamiento", icon: BedDouble }
];

export function OutreachWorkspace({ initialContacts, gmailAccount }: OutreachWorkspaceProps) {
  const [contacts, setContacts] = useState<OutreachContact[]>(() => initialContacts.map(contactFromRow));
  const [activeList, setActiveList] = useState<InternalCompanyListType>("empresa");
  const [search, setSearch] = useState("");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [composeContact, setComposeContact] = useState<OutreachContact | null>(null);

  const gmailConnected = Boolean(gmailAccount);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    if (gmail === "connected") {
      setSyncMessage("Gmail conectado correctamente.");
    } else if (gmail === "error") {
      setSyncMessage("No se pudo conectar Gmail. Inténtalo de nuevo.");
    }
    if (gmail) {
      params.delete("gmail");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  const countsByList = useMemo(() => {
    return contacts.reduce(
      (acc, contact) => {
        acc[contact.listType] += 1;
        return acc;
      },
      { empresa: 0, alojamiento: 0 } as Record<InternalCompanyListType, number>
    );
  }, [contacts]);

  const listContacts = useMemo(() => contacts.filter((contact) => contact.listType === activeList), [contacts, activeList]);

  const visibleContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return listContacts;
    return listContacts.filter((contact) =>
      [contact.companyName, contact.email, contact.phone].some((field) => field.toLowerCase().includes(query))
    );
  }, [listContacts, search]);

  function reportError(message: string) {
    setSyncMessage(message);
  }

  function addContact() {
    const contact: OutreachContact = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `contact-${Date.now()}`,
      listType: activeList,
      companyName: "",
      email: "",
      phone: "",
      category: "Hotel/Hub",
      status: "Por contactar",
      priority: "Media",
      ownerId: "",
      nextStep: "Enviar email",
      followUpDate: ""
    };

    setContacts((current) => [...current, contact]);
    createContactRequest(contact)
      .then((response) => {
        if (!response.ok) throw new Error();
      })
      .catch(() => reportError("No se pudo guardar el nuevo contacto en el servidor. Revisa tu conexión."));
  }

  function patchContact(id: string, patch: Partial<OutreachContact>, persist: boolean) {
    setContacts((current) => current.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact)));

    if (persist) {
      patchContactRequest(id, patch)
        .then((response) => {
          if (!response.ok) throw new Error();
        })
        .catch(() => reportError("No se pudo guardar el cambio en el servidor. Revisa tu conexión."));
    }
  }

  function deleteContact(id: string) {
    setContacts((current) => current.filter((contact) => contact.id !== id));
    deleteContactRequest(id)
      .then((response) => {
        if (!response.ok) throw new Error();
      })
      .catch(() => reportError("No se pudo eliminar el contacto en el servidor. Revisa tu conexión."));
  }

  function handleSent(contactId: string, companyName: string) {
    setContacts((current) => current.map((contact) => (contact.id === contactId ? { ...contact, status: "Contactado" } : contact)));
    setSyncMessage(`Correo enviado a ${companyName || "el contacto"}.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="inline-flex w-full gap-1 rounded-xl border border-border bg-surface-elevated p-1 shadow-card sm:w-auto" aria-label="Listas de contacto">
          {LIST_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeList === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveList(tab.value)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none",
                  isActive ? "bg-primary text-white shadow-sm" : "text-text-muted hover:bg-surface-muted hover:text-text"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{LIST_META[tab.value].label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    isActive ? "bg-white/20 text-white" : "bg-surface-muted text-text-muted"
                  )}
                >
                  {countsByList[tab.value]}
                </span>
              </button>
            );
          })}
        </nav>

        {gmailConnected ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
            title={gmailAccount?.email}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Gmail conectado
          </span>
        ) : null}
      </div>

      <OutreachPendingStrip contacts={listContacts} />

      {syncMessage ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>{syncMessage}</span>
          <button type="button" onClick={() => setSyncMessage(null)} className="text-xs font-semibold underline">
            Cerrar
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Buscar ${LIST_META[activeList].singular}...`}
            aria-label="Buscar contacto"
            className="pl-9"
          />
        </div>
        <Button type="button" onClick={addContact}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Añadir {LIST_META[activeList].singular}
        </Button>
      </div>

      <OutreachTable contacts={visibleContacts} onPatch={patchContact} onDelete={deleteContact} onComposeEmail={setComposeContact} />

      {composeContact ? (
        <OutreachEmailModal
          contact={composeContact}
          gmailConnected={gmailConnected}
          onSent={handleSent}
          onClose={() => setComposeContact(null)}
        />
      ) : null}
    </div>
  );
}
