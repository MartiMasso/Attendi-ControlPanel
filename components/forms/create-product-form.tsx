"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES: Record<string, string[]> = {
  Audiovisual: ["Cámaras", "Drones"],
  Automoción: ["Autocaravana", "Autocaravanas", "Campers", "Coche", "Moto"],
  "Camping y Outdoor": ["Tiendas de campaña"],
  Construcción: ["Andamios"],
  "Deportes de aventura": ["Fútbol golf", "Humor amarillo", "Otros", "Paintball de adulto", "Paintball infantil", "Quads"],
  "Deportes de raqueta": ["Padel"],
  Deportes: ["Bicicletas", "Esquí", "Patinetes"],
  Electrodomésticos: ["Aires acondicionados"],
  Herramientas: ["Multiherramientas"],
  "Movilidad personal": ["Bicicletas", "Bicicletas eléctricas", "Otros", "Patinetes"],
  Música: ["Altavoces", "Instrumentos", "Mesas de mezcla"],
  Náutica: ["Barcos con licencia", "Náutica", "Surf", "Tablas de surf"],
  Tecnología: ["Tablets"]
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-text-muted">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="col-span-full text-xs font-semibold uppercase tracking-widest text-text-muted">{children}</p>;
}

export function CreateProductForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Basic
  const [ownerEmail, setOwnerEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");

  // Pricing
  const [rentalType, setRentalType] = useState<"daily" | "hourly">("daily");
  const [pricePerDay, setPricePerDay] = useState("");
  const [pricePerWeek, setPricePerWeek] = useState("");
  const [pricePerMonth, setPricePerMonth] = useState("");
  const [pricePerHour, setPricePerHour] = useState("");

  // Deposit
  const [fianzaRequired, setFianzaRequired] = useState(false);
  const [fianza, setFianza] = useState("");

  // Stock & visibility
  const [stockTotal, setStockTotal] = useState("1");
  const [isHidden, setIsHidden] = useState(false);
  const [insured, setInsured] = useState(false);

  const subcategories = category ? CATEGORIES[category] ?? [] : [];

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setSubcategory("");
  };

  const num = (val: string) => (val.trim() ? parseFloat(val.trim()) : null);
  const int = (val: string) => (val.trim() ? parseInt(val.trim(), 10) : null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!ownerEmail.trim()) { setError("Owner email is required."); return; }
    if (!title.trim()) { setError("Title is required."); return; }
    if (!category) { setError("Category is required."); return; }

    const parsedStock = int(stockTotal);
    if (parsedStock === null || parsedStock < 1) { setError("Stock must be at least 1."); return; }

    startTransition(async () => {
      const response = await fetch("/api/admin/create-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: ownerEmail.trim(),
          title: title.trim(),
          description: description.trim() || null,
          category,
          subcategory: subcategory || null,
          rentalType,
          pricePerDay: num(pricePerDay),
          pricePerWeek: num(pricePerWeek),
          pricePerMonth: num(pricePerMonth),
          pricePerHour: num(pricePerHour),
          fianzaRequired,
          fianza: fianzaRequired ? num(fianza) : null,
          stockTotal: parsedStock,
          isHidden,
          insured
        })
      });

      const rawText = await response.text().catch(() => "");
      let data: { error?: string; message?: string; product?: { id: string } } | null = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }

      if (!response.ok) {
        setError(data?.error || data?.message || rawText.slice(0, 300) || `Server error (${response.status})`);
        return;
      }

      setSuccess(`Product created. ID: ${data?.product?.id}`);
      setOwnerEmail("");
      setTitle("");
      setDescription("");
      setCategory("");
      setSubcategory("");
      setRentalType("daily");
      setPricePerDay("");
      setPricePerWeek("");
      setPricePerMonth("");
      setPricePerHour("");
      setFianzaRequired(false);
      setFianza("");
      setStockTotal("1");
      setIsHidden(false);
      setInsured(false);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface-elevated p-5">
      <div>
        <h2 className="text-sm font-semibold text-text">Create Product</h2>
        <p className="mt-1 text-xs text-text-muted">
          Products can be created for any account regardless of Stripe or company info status.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SectionTitle>Owner</SectionTitle>

        <Field label="Owner email" required>
          <Input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@example.com"
            required
          />
        </Field>

        <div />

        <SectionTitle>Basic info</SectionTitle>

        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product title" required />
        </Field>

        <Field label="Category" required>
          <Select value={category} onChange={(e) => handleCategoryChange(e.target.value)} required>
            <option value="">Select category…</option>
            {Object.keys(CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
        </Field>

        <Field label="Subcategory">
          <Select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            disabled={!category || subcategories.length === 0}
          >
            <option value="">Select subcategory…</option>
            {subcategories.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </Select>
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Product description…"
            className="sm:col-span-2"
          />
        </Field>

        <SectionTitle>Pricing</SectionTitle>

        <Field label="Rental type" required>
          <Select value={rentalType} onChange={(e) => setRentalType(e.target.value as "daily" | "hourly")}>
            <option value="daily">Por días</option>
            <option value="hourly">Por horas</option>
          </Select>
        </Field>

        {rentalType === "daily" ? (
          <>
            <Field label="Price per day (€)">
              <Input type="number" step="0.01" min="0" value={pricePerDay} onChange={(e) => setPricePerDay(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Price per week (€)">
              <Input type="number" step="0.01" min="0" value={pricePerWeek} onChange={(e) => setPricePerWeek(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Price per month (€)">
              <Input type="number" step="0.01" min="0" value={pricePerMonth} onChange={(e) => setPricePerMonth(e.target.value)} placeholder="0.00" />
            </Field>
          </>
        ) : (
          <Field label="Price per hour (€)">
            <Input type="number" step="0.01" min="0" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)} placeholder="0.00" />
          </Field>
        )}

        <SectionTitle>Deposit</SectionTitle>

        <Field label="Fianza required">
          <label className="flex items-center gap-2 pt-2 text-sm text-text">
            <input
              type="checkbox"
              checked={fianzaRequired}
              onChange={(e) => setFianzaRequired(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Require deposit from renter
          </label>
        </Field>

        {fianzaRequired ? (
          <Field label="Deposit amount (€)">
            <Input type="number" step="0.01" min="0" value={fianza} onChange={(e) => setFianza(e.target.value)} placeholder="0.00" />
          </Field>
        ) : (
          <div />
        )}

        <SectionTitle>Stock & visibility</SectionTitle>

        <Field label="Total stock" required>
          <Input type="number" min="1" step="1" value={stockTotal} onChange={(e) => setStockTotal(e.target.value)} placeholder="1" />
        </Field>

        <Field label="Options">
          <div className="space-y-2 pt-1 text-sm text-text">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isHidden} onChange={(e) => setIsHidden(e.target.checked)} className="h-4 w-4 rounded border-border" />
              Hidden (not visible to users)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={insured} onChange={(e) => setInsured(e.target.checked)} className="h-4 w-4 rounded border-border" />
              Insured
            </label>
          </div>
        </Field>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success ? <p className="text-xs text-[#22c55e]">{success}</p> : null}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Creating…" : "Create product"}
      </Button>
    </form>
  );
}
