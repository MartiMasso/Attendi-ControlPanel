"use client";

import { CalendarCheck, Mail, MailX, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { isValidDateKey, type OutreachContact } from "@/components/internal-hub/outreach-shared";

interface OutreachPendingStripProps {
  contacts: OutreachContact[];
}

interface Metric {
  key: string;
  label: string;
  value: number;
  icon: typeof Mail;
  tone: string;
}

export function OutreachPendingStrip({ contacts }: OutreachPendingStripProps) {
  const total = contacts.length;
  const conEmail = contacts.filter((contact) => contact.email.trim().length > 0).length;
  const sinEmail = total - conEmail;
  const demos = contacts.filter((contact) => isValidDateKey(contact.followUpDate)).length;

  const metrics: Metric[] = [
    { key: "total", label: "Total", value: total, icon: Users, tone: "bg-slate-100 text-slate-600" },
    { key: "con-email", label: "Con email", value: conEmail, icon: Mail, tone: "bg-blue-100 text-blue-700" },
    { key: "sin-email", label: "Sin email", value: sinEmail, icon: MailX, tone: "bg-amber-100 text-amber-700" },
    { key: "demos", label: "Demos programadas", value: demos, icon: CalendarCheck, tone: "bg-emerald-100 text-emerald-700" }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div key={metric.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3 shadow-card">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", metric.tone)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-none text-text">{metric.value}</p>
              <p className="mt-1 truncate text-xs text-text-muted">{metric.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
