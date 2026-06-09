"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationPicker, type LocationResult } from "@/components/ui/location-picker";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ImageEntry {
  file: File;
  preview: string;
  uploading: boolean;
  url: string | null;
  error: string | null;
}

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

  // Images
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageEntry[]>([]);

  // Owner
  const [ownerMode, setOwnerMode] = useState<"email" | "userId">("email");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");

  // Basic
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

  // Location
  const [locationDisplay, setLocationDisplay] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);

  const handleLocationSelect = (result: LocationResult) => {
    setLocationDisplay(result.displayName);
    setLocationLat(result.lat);
    setLocationLng(result.lng);
  };

  const ownerValue = ownerMode === "email" ? ownerEmail.trim() : ownerUserId.trim();

  const subcategories = category ? CATEGORIES[category] ?? [] : [];

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setSubcategory("");
  };

  const num = (val: string) => (val.trim() ? parseFloat(val.trim()) : null);
  const int = (val: string) => (val.trim() ? parseInt(val.trim(), 10) : null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const entries: ImageEntry[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      url: null,
      error: null
    }));
    setImages((prev) => [...prev, ...entries]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const entry = images[i];
      if (entry.url) { urls.push(entry.url); continue; }

      setImages((prev) => prev.map((img, idx) => idx === i ? { ...img, uploading: true, error: null } : img));

      const fd = new FormData();
      fd.append("file", entry.file);

      const res = await fetch("/api/admin/upload-product-image", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!res.ok || !json?.url) {
        const errMsg = json?.error ?? "Upload failed";
        setImages((prev) => prev.map((img, idx) => idx === i ? { ...img, uploading: false, error: errMsg } : img));
        throw new Error(`Image "${entry.file.name}": ${errMsg}`);
      }

      setImages((prev) => prev.map((img, idx) => idx === i ? { ...img, uploading: false, url: json.url! } : img));
      urls.push(json.url!);
    }

    return urls;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!ownerValue) { setError(ownerMode === "email" ? "Owner email is required." : "Owner user ID is required."); return; }
    if (!title.trim()) { setError("Title is required."); return; }
    if (!category) { setError("Category is required."); return; }

    const parsedStock = int(stockTotal);
    if (parsedStock === null || parsedStock < 1) { setError("Stock must be at least 1."); return; }

    startTransition(async () => {
      let imageUrls: string[] = [];
      try {
        imageUrls = await uploadImages();
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : "Image upload failed");
        return;
      }

      const response = await fetch("/api/admin/create-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(ownerMode === "email" ? { ownerEmail: ownerEmail.trim() } : { ownerUserId: ownerUserId.trim() }),
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
          insured,
          imageUrls,
          locationDisplay: locationDisplay || null,
          locationLat,
          locationLng
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
      setOwnerUserId("");
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
      setLocationDisplay("");
      setLocationLat(null);
      setLocationLng(null);
      setImages([]);
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

        <div className="col-span-full flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1 w-fit">
          <button
            type="button"
            onClick={() => setOwnerMode("email")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${ownerMode === "email" ? "bg-surface-elevated text-text shadow-sm" : "text-text-muted hover:text-text"}`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setOwnerMode("userId")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${ownerMode === "userId" ? "bg-surface-elevated text-text shadow-sm" : "text-text-muted hover:text-text"}`}
          >
            User ID
          </button>
        </div>

        {ownerMode === "email" ? (
          <Field label="Owner email" required>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </Field>
        ) : (
          <Field label="Owner user ID" required>
            <Input
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="font-mono text-xs"
            />
          </Field>
        )}

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

        <SectionTitle>Location</SectionTitle>

        <div className="col-span-full space-y-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">Search address</label>
            <LocationPicker
              onSelect={handleLocationSelect}
              placeholder="Search address or city…"
              initialValue={locationDisplay}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">Location display name</label>
            <Input
              value={locationDisplay}
              onChange={(e) => setLocationDisplay(e.target.value)}
              placeholder="Auto-filled from picker or enter manually"
            />
          </div>
          {locationLat !== null && (
            <p className="text-xs text-text-muted">
              Coordinates: {locationLat.toFixed(5)}, {locationLng?.toFixed(5)}
            </p>
          )}
        </div>

        <SectionTitle>Images</SectionTitle>

        <div className="col-span-full space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                  {img.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-xs font-medium text-white">Uploading…</span>
                    </div>
                  )}
                  {img.error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-500/80 p-1">
                      <span className="text-center text-[10px] font-medium text-white">{img.error}</span>
                    </div>
                  )}
                  {img.url && (
                    <div className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#22c55e]" />
                  )}
                  {!img.uploading && (
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-text-muted transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add images
          </button>
          <p className="text-xs text-text-muted">JPEG, PNG, WebP or GIF · max 5 MB each</p>
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success ? <p className="text-xs text-[#22c55e]">{success}</p> : null}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Creating…" : "Create product"}
      </Button>
    </form>
  );
}
