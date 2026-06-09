"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationPicker, type LocationResult } from "@/components/ui/location-picker";
import { Select } from "@/components/ui/select";

export function CreateAccountForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [accountType, setAccountType] = useState<"hotel" | "business">("hotel");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Location (hotel)
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [preciseLocation, setPreciseLocation] = useState("");

  const handleLocationSelect = (result: LocationResult) => {
    setPreciseLocation(result.displayName);
    if (result.street) setStreet(result.street);
    if (result.houseNumber) setStreetNumber(result.houseNumber);
    if (result.city) setCity(result.city);
    if (result.postcode) setPostalCode(result.postcode);
  };

  // Profile photo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", photoFile);
      const res = await fetch("/api/admin/upload-profile-image", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) throw new Error(json?.error ?? "Upload failed");
      return json.url;
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !username.trim()) {
      setError("Email and username are required.");
      return;
    }

    startTransition(async () => {
      let profilePhotoUrl: string | null = null;
      try {
        profilePhotoUrl = await uploadPhoto();
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : "Profile image upload failed");
        return;
      }

      const response = await fetch("/api/admin/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim() || undefined,
          username: username.trim(),
          accountType,
          profilePhotoUrl,
          street: street.trim() || null,
          streetNumber: streetNumber.trim() || null,
          city: city.trim() || null,
          postalCode: postalCode.trim() || null,
          preciseLocation: preciseLocation.trim() || null
        })
      });

      const rawText = await response.text().catch(() => "");
      let data: { error?: string; message?: string; userId?: string } | null = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }

      if (!response.ok) {
        setError(data?.error || data?.message || rawText.slice(0, 300) || `Server error (${response.status})`);
        return;
      }

      setSuccess(`Account created successfully. User ID: ${data?.userId}`);
      setEmail("");
      setFullName("");
      setUsername("");
      setAccountType("hotel");
      setStreet("");
      setStreetNumber("");
      setCity("");
      setPostalCode("");
      setPreciseLocation("");
      removePhoto();
      router.refresh();
    });
  };

  const isWorking = isPending || photoUploading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface-elevated p-5">
      <div>
        <h2 className="text-sm font-semibold text-text">Create Hotel / Company Account</h2>
        <p className="mt-1 text-xs text-text-muted">
          Password is set to <code className="rounded bg-surface-muted px-1 py-0.5">Attendi12345@</code>. Email is auto-verified — no email sent.
        </p>
      </div>

      {/* Profile photo picker */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isWorking}
            className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-surface-muted transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {photoPreview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera size={20} className="text-text-muted group-hover:text-primary" />
            )}
            {photoUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <span className="text-[10px] font-semibold text-white">…</span>
              </div>
            )}
          </button>
          {photoPreview && !isWorking && (
            <button
              type="button"
              onClick={removePhoto}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow"
            >
              <X size={10} />
            </button>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-text">Profile image <span className="text-text-muted">(optional)</span></p>
          <p className="text-xs text-text-muted">JPEG, PNG or WebP · max 5 MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Account type</label>
          <Select value={accountType} onChange={(e) => setAccountType(e.target.value as "hotel" | "business")}>
            <option value="hotel">Hotel</option>
            <option value="business">Company (Business)</option>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Email *</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hotel@example.com"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Username *</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="hotel_username"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Full name</label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Hotel Name S.L."
          />
        </div>
      </div>

      {/* Location — shown for all account types; most relevant for hotels */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Location</p>
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Search address</label>
          <LocationPicker
            onSelect={handleLocationSelect}
            placeholder="Search address or city…"
            initialValue={preciseLocation}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">Street</label>
            <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Calle Mayor" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">Number</label>
            <Input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} placeholder="12" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">Postal code</label>
            <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="08001" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">City</label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Barcelona" />
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success ? <p className="text-xs text-[#22c55e]">{success}</p> : null}

      <Button type="submit" size="sm" disabled={isWorking}>
        {photoUploading ? "Uploading image…" : isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
