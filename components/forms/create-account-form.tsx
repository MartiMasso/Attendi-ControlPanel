"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";

import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationField, type LocationResult } from "@/components/ui/location-field";
import { Select } from "@/components/ui/select";

export function CreateAccountForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [accountType, setAccountType] = useState<"hotel" | "business">("hotel");
  const [generateEmail, setGenerateEmail] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  // Location (hotel)
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [preciseLocation, setPreciseLocation] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");

  const handleLocationSelect = (result: LocationResult) => {
    setLocationLat(result.lat);
    setLocationLng(result.lng);
    if (result.street) setStreet(result.street);
    if (result.houseNumber) setStreetNumber(result.houseNumber);
    if (result.city) setCity(result.city);
    if (result.postcode) setPostalCode(result.postcode);
  };

  const handleCoordinatesChange = (lat: number | null, lng: number | null) => {
    setLocationLat(lat);
    setLocationLng(lng);
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

    if (!generateEmail && !email.trim()) {
      setError("Email is required, or check 'Auto-generate'.");
      return;
    }
    if (!username.trim()) {
      setError("Username is required.");
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
          ...(generateEmail ? { generateEmail: true } : { email: email.trim() }),
          verifyEmail,
          fullName: fullName.trim() || undefined,
          username: username.trim(),
          accountType,
          profilePhotoUrl,
          street: street.trim() || null,
          streetNumber: streetNumber.trim() || null,
          city: city.trim() || null,
          postalCode: postalCode.trim() || null,
          preciseLocation: preciseLocation.trim() || null,
          locationLat,
          locationLng,
          publicPhone: publicPhone.trim() || null,
          publicEmail: publicEmail.trim() || null
        })
      });

      const rawText = await response.text().catch(() => "");
      let data: { error?: string; message?: string; userId?: string; email?: string } | null = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }

      if (!response.ok) {
        setError(data?.error || data?.message || rawText.slice(0, 300) || `Server error (${response.status})`);
        return;
      }

      const emailNote = generateEmail && data?.email ? ` · Email: ${data.email}` : "";
      setSuccess(`Account created successfully. User ID: ${data?.userId}${emailNote}`);
      setCreatedUserId(data?.userId ?? null);
      setEmail("");
      setGenerateEmail(false);
      setVerifyEmail(true);
      setFullName("");
      setUsername("");
      setAccountType("hotel");
      setStreet("");
      setStreetNumber("");
      setCity("");
      setPostalCode("");
      setPreciseLocation("");
      setLocationLat(null);
      setLocationLng(null);
      setPublicPhone("");
      setPublicEmail("");
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
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-muted">
              Email{!generateEmail && " *"}
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-muted select-none">
              <input
                type="checkbox"
                checked={generateEmail}
                onChange={(e) => {
                  setGenerateEmail(e.target.checked);
                  if (e.target.checked) setEmail("");
                }}
                disabled={isWorking}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Auto-generate
            </label>
          </div>
          {generateEmail ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-text-muted">
              <span className="font-mono">attendi***@yopmail.com</span>
            </div>
          ) : (
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hotel@example.com"
              disabled={isWorking}
            />
          )}
        </div>

        <div className="col-span-full">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text select-none">
            <input
              type="checkbox"
              checked={verifyEmail}
              onChange={(e) => setVerifyEmail(e.target.checked)}
              disabled={isWorking}
              className="h-4 w-4 rounded border-border"
            />
            Verify email immediately
            <span className="text-xs text-text-muted">(uncheck to require email confirmation)</span>
          </label>
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
          <LocationField
            onSelect={handleLocationSelect}
            onCoordinatesChange={handleCoordinatesChange}
            onPublicLocationChange={(val) => setPreciseLocation(val)}
            placeholder="Search address or city…"
            initialValue={preciseLocation}
            initialPublicLocation={preciseLocation}
            initialLat={locationLat}
            initialLng={locationLng}
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">Public phone</label>
            <Input type="tel" value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} placeholder="+34 600 000 000" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">Public email</label>
            <Input type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} placeholder="info@hotel.com" />
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success && (
        <div className="space-y-1">
          <p className="text-xs text-[#22c55e]">{success}</p>
          {createdUserId && (
            <a
              href={`${process.env.NEXT_PUBLIC_ATTENDI_APP_URL ?? "https://attendi.es"}/seller/${createdUserId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View profile
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      <Button type="submit" size="sm" disabled={isWorking}>
        {photoUploading ? "Uploading image…" : isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
