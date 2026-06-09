"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationField, type LocationResult } from "@/components/ui/location-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ProductData {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  rental_type: "daily" | "hourly";
  price_per_day: number | null;
  price_per_week: number | null;
  price_per_month: number | null;
  price_per_hour: number | null;
  fianza_required: boolean;
  fianza: number | null;
  stock_total: number;
  is_hidden: boolean;
  insured: boolean;
  image_url: string[] | null;
  location_display: string | null;
  location_lat: number | null;
  location_lng: number | null;
}

interface ImageEntry {
  src: string;          // blob preview OR already-uploaded URL
  file: File | null;    // null when it's an existing remote URL
  uploading: boolean;
  url: string | null;   // confirmed remote URL (null while pending upload)
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
      <label className="text-xs font-medium text-text-muted">{label}{required ? " *" : ""}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="col-span-full text-xs font-semibold uppercase tracking-widest text-text-muted">{children}</p>;
}

export function EditProductForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Lookup
  const [productId, setProductId] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Product state (null = not loaded yet)
  const [loadedProduct, setLoadedProduct] = useState<ProductData | null>(null);

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [rentalType, setRentalType] = useState<"daily" | "hourly">("daily");
  const [pricePerDay, setPricePerDay] = useState("");
  const [pricePerWeek, setPricePerWeek] = useState("");
  const [pricePerMonth, setPricePerMonth] = useState("");
  const [pricePerHour, setPricePerHour] = useState("");
  const [fianzaRequired, setFianzaRequired] = useState(false);
  const [fianza, setFianza] = useState("");
  const [stockTotal, setStockTotal] = useState("1");
  const [isHidden, setIsHidden] = useState(false);
  const [insured, setInsured] = useState(false);
  const [locationDisplay, setLocationDisplay] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [images, setImages] = useState<ImageEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLoad = async () => {
    if (!productId.trim()) return;
    setLoadError(null);
    setLoadingProduct(true);
    setLoadedProduct(null);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/get-product?id=${encodeURIComponent(productId.trim())}`);
      const rawText = await res.text().catch(() => "");
      let data: { product?: ProductData; error?: string } | null = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }

      if (!res.ok || !data?.product) {
        setLoadError(data?.error || `Error ${res.status}`);
        return;
      }

      const p = data.product;
      setLoadedProduct(p);
      setTitle(p.title ?? "");
      setDescription(p.description ?? "");
      setCategory(p.category ?? "");
      setSubcategory(p.subcategory ?? "");
      setRentalType(p.rental_type ?? "daily");
      setPricePerDay(p.price_per_day != null ? String(p.price_per_day) : "");
      setPricePerWeek(p.price_per_week != null ? String(p.price_per_week) : "");
      setPricePerMonth(p.price_per_month != null ? String(p.price_per_month) : "");
      setPricePerHour(p.price_per_hour != null ? String(p.price_per_hour) : "");
      setFianzaRequired(p.fianza_required ?? false);
      setFianza(p.fianza != null ? String(p.fianza) : "");
      setStockTotal(String(p.stock_total ?? 1));
      setIsHidden(p.is_hidden ?? false);
      setInsured(p.insured ?? false);
      setLocationDisplay(p.location_display ?? "");
      setLocationLat(p.location_lat ?? null);
      setLocationLng(p.location_lng ?? null);

      // Existing images: no File, url already known
      const existingImages: ImageEntry[] = (p.image_url ?? []).map((url: string) => ({
        src: url,
        file: null,
        uploading: false,
        url,
        error: null
      }));
      setImages(existingImages);
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleLocationSelect = (result: LocationResult) => {
    setLocationLat(result.lat);
    setLocationLng(result.lng);
  };

  const handleCoordinatesChange = (lat: number | null, lng: number | null) => {
    setLocationLat(lat);
    setLocationLng(lng);
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setSubcategory("");
  };

  const subcategories = category ? CATEGORIES[category] ?? [] : [];
  const num = (val: string) => (val.trim() ? parseFloat(val.trim()) : null);
  const int = (val: string) => (val.trim() ? parseInt(val.trim(), 10) : null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const entries: ImageEntry[] = files.map((file) => ({
      src: URL.createObjectURL(file),
      file,
      uploading: false,
      url: null,
      error: null
    }));
    setImages((prev) => [...prev, ...entries]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const entry = prev[index];
      if (entry.file) URL.revokeObjectURL(entry.src);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadNewImages = async (): Promise<string[]> => {
    const urls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const entry = images[i];

      // Already uploaded or it's an existing remote URL
      if (entry.url) { urls.push(entry.url); continue; }

      setImages((prev) => prev.map((img, idx) => idx === i ? { ...img, uploading: true, error: null } : img));

      const fd = new FormData();
      fd.append("file", entry.file!);
      const res = await fetch("/api/admin/upload-product-image", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!res.ok || !json?.url) {
        const errMsg = json?.error ?? "Upload failed";
        setImages((prev) => prev.map((img, idx) => idx === i ? { ...img, uploading: false, error: errMsg } : img));
        throw new Error(`Image "${entry.file!.name}": ${errMsg}`);
      }

      setImages((prev) => prev.map((img, idx) => idx === i ? { ...img, uploading: false, url: json.url! } : img));
      urls.push(json.url!);
    }

    return urls;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loadedProduct) return;
    setError(null);
    setSuccess(null);

    if (!title.trim()) { setError("Title is required."); return; }
    if (!category) { setError("Category is required."); return; }
    const parsedStock = int(stockTotal);
    if (parsedStock === null || parsedStock < 1) { setError("Stock must be at least 1."); return; }

    startTransition(async () => {
      let imageUrls: string[] = [];
      try {
        imageUrls = await uploadNewImages();
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : "Image upload failed");
        return;
      }

      const res = await fetch("/api/admin/edit-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: loadedProduct.id,
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

      const rawText = await res.text().catch(() => "");
      let data: { error?: string; message?: string } | null = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }

      if (!res.ok) {
        setError(data?.error || data?.message || rawText.slice(0, 300) || `Server error (${res.status})`);
        return;
      }

      setSuccess(`Product "${title.trim()}" updated successfully.`);
      router.refresh();
    });
  };

  const isWorking = isPending || loadingProduct;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface-elevated p-5">
      <div>
        <h2 className="text-sm font-semibold text-text">Edit Product</h2>
        <p className="mt-1 text-xs text-text-muted">Load a product by ID to edit its details.</p>
      </div>

      {/* Lookup */}
      <div className="flex gap-2">
        <Input
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="Product UUID…"
          className="flex-1 font-mono text-xs"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLoad(); } }}
          disabled={isWorking}
        />
        <Button type="button" size="sm" onClick={handleLoad} disabled={isWorking || !productId.trim()}>
          {loadingProduct ? "Loading…" : "Load"}
        </Button>
      </div>

      {loadError && <p className="text-xs text-danger">{loadError}</p>}

      {loadedProduct && (
        <>
          <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-text-muted">
            ID: <span className="font-mono text-text">{loadedProduct.id}</span>
            {" · "}owner: <span className="font-mono">{loadedProduct.user_id}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SectionTitle>Basic info</SectionTitle>

            <Field label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product title" disabled={isWorking} />
            </Field>

            <Field label="Category" required>
              <Select value={category} onChange={(e) => handleCategoryChange(e.target.value)} disabled={isWorking}>
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
                disabled={isWorking || !category || subcategories.length === 0}
              >
                <option value="">None</option>
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
                disabled={isWorking}
              />
            </Field>

            <SectionTitle>Pricing</SectionTitle>

            <Field label="Rental type" required>
              <Select value={rentalType} onChange={(e) => setRentalType(e.target.value as "daily" | "hourly")} disabled={isWorking}>
                <option value="daily">Por días</option>
                <option value="hourly">Por horas</option>
              </Select>
            </Field>

            {rentalType === "daily" ? (
              <>
                <Field label="Price per day (€)">
                  <Input type="number" step="0.01" min="0" value={pricePerDay} onChange={(e) => setPricePerDay(e.target.value)} placeholder="0.00" disabled={isWorking} />
                </Field>
                <Field label="Price per week (€)">
                  <Input type="number" step="0.01" min="0" value={pricePerWeek} onChange={(e) => setPricePerWeek(e.target.value)} placeholder="0.00" disabled={isWorking} />
                </Field>
                <Field label="Price per month (€)">
                  <Input type="number" step="0.01" min="0" value={pricePerMonth} onChange={(e) => setPricePerMonth(e.target.value)} placeholder="0.00" disabled={isWorking} />
                </Field>
              </>
            ) : (
              <Field label="Price per hour (€)">
                <Input type="number" step="0.01" min="0" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)} placeholder="0.00" disabled={isWorking} />
              </Field>
            )}

            <SectionTitle>Deposit</SectionTitle>

            <Field label="Fianza required">
              <label className="flex items-center gap-2 pt-2 text-sm text-text">
                <input type="checkbox" checked={fianzaRequired} onChange={(e) => setFianzaRequired(e.target.checked)} disabled={isWorking} className="h-4 w-4 rounded border-border" />
                Require deposit from renter
              </label>
            </Field>

            {fianzaRequired ? (
              <Field label="Deposit amount (€)">
                <Input type="number" step="0.01" min="0" value={fianza} onChange={(e) => setFianza(e.target.value)} placeholder="0.00" disabled={isWorking} />
              </Field>
            ) : <div />}

            <SectionTitle>Stock & visibility</SectionTitle>

            <Field label="Total stock" required>
              <Input type="number" min="1" step="1" value={stockTotal} onChange={(e) => setStockTotal(e.target.value)} disabled={isWorking} />
            </Field>

            <Field label="Options">
              <div className="space-y-2 pt-1 text-sm text-text">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isHidden} onChange={(e) => setIsHidden(e.target.checked)} disabled={isWorking} className="h-4 w-4 rounded border-border" />
                  Hidden (not visible to users)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={insured} onChange={(e) => setInsured(e.target.checked)} disabled={isWorking} className="h-4 w-4 rounded border-border" />
                  Insured
                </label>
              </div>
            </Field>

            <SectionTitle>Location</SectionTitle>

            <div className="col-span-full space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Search address</label>
                <LocationField
                  key={loadedProduct.id}
                  onSelect={handleLocationSelect}
                  onCoordinatesChange={handleCoordinatesChange}
                  onPublicLocationChange={(val) => setLocationDisplay(val)}
                  placeholder="Search address or city…"
                  initialValue={locationDisplay}
                  initialPublicLocation={locationDisplay}
                  initialLat={locationLat}
                  initialLng={locationLng}
                />
              </div>
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
                      <img src={img.src} alt="" className="h-full w-full object-cover" />
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
                      {img.url && !img.uploading && (
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
                disabled={isWorking}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-text-muted transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add images
              </button>
              <p className="text-xs text-text-muted">JPEG, PNG, WebP or GIF · max 5 MB each</p>
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          {success && (
            <div className="space-y-1">
              <p className="text-xs text-[#22c55e]">{success}</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`${process.env.NEXT_PUBLIC_ATTENDI_APP_URL ?? "https://attendi.es"}/product/${loadedProduct.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View product
                  <ExternalLink size={11} />
                </a>
                <a
                  href={`${process.env.NEXT_PUBLIC_ATTENDI_APP_URL ?? "https://attendi.es"}/seller/${loadedProduct.user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View seller profile
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )}

          <Button type="submit" size="sm" disabled={isWorking}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </>
      )}
    </form>
  );
}
