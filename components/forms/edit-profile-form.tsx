"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronDown, ExternalLink, QrCode, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationField, type LocationResult } from "@/components/ui/location-field";
import { Select } from "@/components/ui/select";

interface ProfileData {
  userId: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  accountType: string | null;
  profilePhotoUrl: string | null;
  backgroundImageUrl: string | null;
  verificationStatus: string | null;
  businessName: string | null;
  latitude: number | null;
  longitude: number | null;
  preciseLocation: string | null;
  hotelPublicAddress: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  street: string | null;
  streetNumber: string | null;
  city: string | null;
  postalCode: string | null;
  stripeAccountId: string | null;
  companySetupComplete: boolean | null;
  hotelCode: string | null;
  primaryLocationId: string | null;
}

interface BackgroundOption {
  name: string;
  url: string;
}

export function EditProfileForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Lookup
  const [query, setQuery] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [accountType, setAccountType] = useState("");
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);

  // Email update
  const [newEmail, setNewEmail] = useState("");
  const [verifyNewEmail, setVerifyNewEmail] = useState(true);

  // Location
  const [preciseLocation, setPreciseLocation] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");

  // Profile photo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Backgrounds
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([]);
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Stripe reset
  const [resetStripeLoading, setResetStripeLoading] = useState(false);
  const [resetStripeError, setResetStripeError] = useState<string | null>(null);
  const [resetStripeSuccess, setResetStripeSuccess] = useState(false);

  // QR download
  const [qrLoading, setQrLoading] = useState(false);

  // Background picker
  const [bgOpen, setBgOpen] = useState(false);

  useEffect(() => {
    setLoadingBackgrounds(true);
    fetch("/api/admin/list-backgrounds")
      .then((r) => r.json())
      .then((data: { backgrounds?: BackgroundOption[] }) => {
        if (data.backgrounds) setBackgrounds(data.backgrounds);
      })
      .catch(() => { /* silently fail */ })
      .finally(() => setLoadingBackgrounds(false));
  }, []);

  const handleLoad = async () => {
    if (!query.trim()) return;
    setLoadError(null);
    setLoadingProfile(true);
    setProfile(null);
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setError(null);
    setSuccess(null);
    setNewEmail("");

    try {
      const res = await fetch(`/api/admin/get-profile?q=${encodeURIComponent(query.trim())}`);
      const rawText = await res.text().catch(() => "");
      let data: (ProfileData & { error?: string }) | null = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }

      if (!res.ok || !data) {
        setLoadError((data as { error?: string } | null)?.error || `Error ${res.status}`);
        return;
      }

      setProfile(data);
      setFullName(data.fullName ?? "");
      setUsername(data.username ?? "");
      setAccountType(data.accountType ?? "");
      setSelectedBackground(data.backgroundImageUrl ?? null);
      setPreciseLocation(data.preciseLocation ?? "");
      setLocationLat(data.latitude ?? null);
      setLocationLng(data.longitude ?? null);
      setStreet(data.street ?? "");
      setStreetNumber(data.streetNumber ?? "");
      setCity(data.city ?? "");
      setPostalCode(data.postalCode ?? "");
      setPublicPhone(data.publicPhone ?? "");
      setPublicEmail(data.publicEmail ?? "");
    } finally {
      setLoadingProfile(false);
    }
  };

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
    if (!photoFile) return profile?.profilePhotoUrl ?? null;
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

  const handleResetStripe = async () => {
    if (!profile) return;
    if (!confirm(`Remove stripe_account_id and reset company_setup_complete for ${profile.email ?? profile.userId}?`)) return;
    setResetStripeError(null);
    setResetStripeSuccess(false);
    setResetStripeLoading(true);
    try {
      const res = await fetch("/api/admin/reset-stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.userId })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setResetStripeError(data?.error ?? `Error ${res.status}`);
        return;
      }
      setResetStripeSuccess(true);
      setProfile((prev) => prev ? { ...prev, stripeAccountId: null, companySetupComplete: false } : prev);
    } catch (err) {
      setResetStripeError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setResetStripeLoading(false);
    }
  };

  const buildQrUrl = (p: ProfileData) => {
    const base = process.env.NEXT_PUBLIC_ATTENDI_APP_URL ?? "https://www.attendi.es";
    const params = new URLSearchParams();
    if (p.primaryLocationId) params.set("hotel_location_id", p.primaryLocationId);
    if (p.hotelCode) params.set("hotel_code", p.hotelCode);
    return `${base}/seller/${p.userId}?${params.toString()}`;
  };

  const handleDownloadQR = async () => {
    if (!profile) return;
    setQrLoading(true);
    try {
      const QRCode = (await import("qrcode")).default;
      const qrUrl = buildQrUrl(profile);
      const dataUrl = await QRCode.toDataURL(qrUrl, { width: 512, margin: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qr-${profile.hotelCode ?? profile.username ?? profile.userId}.png`;
      link.click();
    } catch (err) {
      console.error("QR generation failed:", err);
    } finally {
      setQrLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      let profilePhotoUrl: string | null | undefined = undefined;
      try {
        if (photoFile) profilePhotoUrl = await uploadPhoto();
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : "Profile image upload failed");
        return;
      }

      const body: Record<string, unknown> = {
        userId: profile.userId,
        fullName: fullName.trim() || null,
        username: username.trim() || null,
        accountType: accountType || null,
        backgroundImageUrl: selectedBackground,
        locationLat,
        locationLng,
        locationDisplay: preciseLocation.trim() || null,
        street: street.trim() || null,
        streetNumber: streetNumber.trim() || null,
        city: city.trim() || null,
        postalCode: postalCode.trim() || null,
        publicPhone: publicPhone.trim() || null,
        publicEmail: publicEmail.trim() || null
      };
      if (profilePhotoUrl !== undefined) body.profilePhotoUrl = profilePhotoUrl;
      if (newEmail.trim()) {
        body.newEmail = newEmail.trim();
        body.verifyNewEmail = verifyNewEmail;
      }

      const res = await fetch("/api/admin/edit-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const rawText = await res.text().catch(() => "");
      let data: { error?: string; message?: string } | null = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }

      if (!res.ok) {
        setError(data?.error || data?.message || rawText.slice(0, 300) || `Server error (${res.status})`);
        return;
      }

      setSuccess("Profile updated successfully.");
      setPhotoFile(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      setNewEmail("");
      router.refresh();
    });
  };

  const isWorking = isPending || photoUploading || loadingProfile;
  const currentPhotoSrc = photoPreview ?? profile?.profilePhotoUrl ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface-elevated p-5">
      <div>
        <h2 className="text-sm font-semibold text-text">Edit Profile</h2>
        <p className="mt-1 text-xs text-text-muted">
          Load a user by email or user ID to edit their profile and background image.
        </p>
      </div>

      {/* Lookup */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email or user ID…"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLoad(); } }}
          disabled={isWorking}
          className="flex-1"
        />
        <Button type="button" size="sm" onClick={handleLoad} disabled={isWorking || !query.trim()}>
          {loadingProfile ? "Loading…" : "Load"}
        </Button>
      </div>

      {loadError && <p className="text-xs text-danger">{loadError}</p>}

      {profile && (
        <>
          {/* Profile info + preview link */}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-text-muted">
            <div className="min-w-0 truncate">
              <span className="font-medium text-text">{profile.email ?? profile.userId}</span>
              {" · "}ID: <span className="font-mono">{profile.userId}</span>
            </div>
            <a
              href={`${process.env.NEXT_PUBLIC_ATTENDI_APP_URL ?? "https://attendi.es"}/seller/${profile.userId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 text-primary hover:underline"
            >
              Preview
              <ExternalLink size={11} />
            </a>
          </div>

          {/* Profile photo */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isWorking}
                className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-surface-muted transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {currentPhotoSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={currentPhotoSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera size={20} className="text-text-muted group-hover:text-primary" />
                )}
                {photoUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <span className="text-[10px] font-semibold text-white">…</span>
                  </div>
                )}
              </button>
              {photoFile && !isWorking && (
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
              <p className="text-xs font-medium text-text">Profile image</p>
              <p className="text-xs text-text-muted">Click to change · JPEG, PNG or WebP · max 5 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Basic fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">Full name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Hotel Name S.L." disabled={isWorking} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="hotel_username" disabled={isWorking} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-text-muted">Account type</label>
              <Select value={accountType} onChange={(e) => setAccountType(e.target.value)} disabled={isWorking}>
                <option value="">— unchanged —</option>
                <option value="consumer">Consumer</option>
                <option value="business">Business</option>
                <option value="hotel">Hotel</option>
              </Select>
            </div>
          </div>

          {/* Email update */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Change email</p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">
                New email <span className="text-text-muted/60">(leave blank to keep current)</span>
              </label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={profile.email ?? "current@email.com"}
                disabled={isWorking}
              />
            </div>
            {newEmail.trim() && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text select-none">
                <input
                  type="checkbox"
                  checked={verifyNewEmail}
                  onChange={(e) => setVerifyNewEmail(e.target.checked)}
                  disabled={isWorking}
                  className="h-4 w-4 rounded border-border"
                />
                Verify new email immediately
                <span className="text-xs text-text-muted">(uncheck to require email confirmation)</span>
              </label>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Location</p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">Search address</label>
              <LocationField
                key={profile.userId}
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
                <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Calle Mayor" disabled={isWorking} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Number</label>
                <Input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} placeholder="12" disabled={isWorking} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Postal code</label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="08001" disabled={isWorking} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">City</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Barcelona" disabled={isWorking} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Public phone</label>
                <Input type="tel" value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} placeholder="+34 600 000 000" disabled={isWorking} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Public email</label>
                <Input type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} placeholder="info@hotel.com" disabled={isWorking} />
              </div>
            </div>
          </div>

          {/* Background picker */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setBgOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Background image</span>
                {selectedBackground && (
                  <div className="h-5 w-8 overflow-hidden rounded border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedBackground} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
              <ChevronDown size={14} className={`text-text-muted transition-transform ${bgOpen ? "rotate-180" : ""}`} />
            </button>

            {bgOpen && (
              <div className="space-y-2 border-t border-border p-3">
                {loadingBackgrounds ? (
                  <p className="text-xs text-text-muted">Loading backgrounds…</p>
                ) : backgrounds.length === 0 ? (
                  <p className="text-xs text-text-muted">No backgrounds found in bucket.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBackground(null)}
                      className={`relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-surface-muted transition ${selectedBackground === null ? "border-primary" : "border-border hover:border-text-muted"}`}
                    >
                      <span className="text-[10px] text-text-muted">None</span>
                      {selectedBackground === null && (
                        <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                    {backgrounds.map((bg) => (
                      <button
                        key={bg.name}
                        type="button"
                        onClick={() => setSelectedBackground(bg.url)}
                        className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${selectedBackground === bg.url ? "border-primary" : "border-border hover:border-text-muted"}`}
                        title={bg.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bg.url} alt={bg.name} className="h-full w-full object-cover" />
                        {selectedBackground === bg.url && (
                          <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                            <Check size={10} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          {success && <p className="text-xs text-[#22c55e]">{success}</p>}

          <Button type="submit" size="sm" disabled={isWorking}>
            {photoUploading ? "Uploading image…" : isPending ? "Saving…" : "Save changes"}
          </Button>

          {/* Stripe & QR actions */}
          <div className="mt-2 space-y-3 rounded-lg border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Stripe & onboarding</p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-medium text-text">Stripe account ID</p>
                <p className="truncate font-mono text-xs text-text-muted">
                  {profile.stripeAccountId ?? <span className="italic">not set</span>}
                </p>
                <p className="text-xs text-text-muted">
                  Company setup: <span className={profile.companySetupComplete ? "text-[#22c55e]" : "text-warning"}>
                    {profile.companySetupComplete === null ? "unknown" : profile.companySetupComplete ? "complete" : "incomplete"}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleResetStripe}
                disabled={isWorking || resetStripeLoading || (!profile.stripeAccountId && profile.companySetupComplete === false)}
                className="shrink-0 bg-danger/10 text-danger hover:bg-danger/20"
              >
                <Trash2 size={13} className="mr-1.5" />
                {resetStripeLoading ? "Removing…" : "Remove Stripe ID"}
              </Button>
            </div>
            {resetStripeError && <p className="text-xs text-danger">{resetStripeError}</p>}
            {resetStripeSuccess && <p className="text-xs text-[#22c55e]">Stripe ID removed and onboarding reset.</p>}

            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">QR code</p>
              <p className="mt-1 text-xs text-text-muted">
                Hotel code: <span className="font-mono font-semibold text-text">{profile.hotelCode ?? <span className="italic">not set</span>}</span>
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                Location ID: <span className="font-mono">{profile.primaryLocationId ?? <span className="italic">not set</span>}</span>
              </p>
              <p className="mt-0.5 break-all text-xs text-text-muted">
                QR URL: <span className="font-mono">{buildQrUrl(profile)}</span>
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadQR}
                disabled={isWorking || qrLoading}
                className="mt-2"
              >
                <QrCode size={13} className="mr-1.5" />
                {qrLoading ? "Generating…" : "Download QR"}
              </Button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}
