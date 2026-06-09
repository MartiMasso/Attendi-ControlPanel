"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

export interface LocationResult {
  displayName: string;
  lat: number;
  lng: number;
  street?: string;
  houseNumber?: string;
  city?: string;
  postcode?: string;
  country?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    country?: string;
    state?: string;
  };
}

function buildDisplayName(p: PhotonFeature["properties"], lat: number, lng: number): string {
  const parts: string[] = [];
  if (p.name && p.name !== p.street) parts.push(p.name);
  if (p.street) parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
  if (p.postcode) parts.push(p.postcode);
  const locality = p.city ?? p.town ?? p.village;
  if (locality) parts.push(locality);
  if (p.state) parts.push(p.state);
  if (p.country) parts.push(p.country);
  return parts.join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function searchLocations(query: string): Promise<LocationResult[]> {
  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).map((f) => {
    const [fLng, fLat] = f.geometry.coordinates;
    const p = f.properties;
    return {
      displayName: buildDisplayName(p, fLat, fLng),
      lat: fLat,
      lng: fLng,
      street: p.street,
      houseNumber: p.housenumber,
      city: p.city ?? p.town ?? p.village,
      postcode: p.postcode,
      country: p.country
    };
  });
}

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 w-full animate-pulse rounded-lg border border-border bg-surface-muted" />
    )
  }
);

interface LocationFieldProps {
  onSelect: (result: LocationResult) => void;
  onCoordinatesChange?: (lat: number | null, lng: number | null) => void;
  onPublicLocationChange?: (value: string) => void;
  placeholder?: string;
  initialValue?: string;
  initialPublicLocation?: string;
  initialLat?: number | null;
  initialLng?: number | null;
}

export function LocationField({
  onSelect,
  onCoordinatesChange,
  onPublicLocationChange,
  placeholder = "Search address…",
  initialValue = "",
  initialPublicLocation = "",
  initialLat = null,
  initialLng = null
}: LocationFieldProps) {
  const [mapLat, setMapLat] = useState<number | null>(initialLat ?? null);
  const [mapLng, setMapLng] = useState<number | null>(initialLng ?? null);

  const [latStr, setLatStr] = useState(initialLat != null ? String(initialLat) : "");
  const [lngStr, setLngStr] = useState(initialLng != null ? String(initialLng) : "");

  const [publicLocation, setPublicLocation] = useState(initialPublicLocation);

  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinned, setPinned] = useState((initialLat ?? null) !== null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    setPinned(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchLocations(val);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 320);
  };

  const handleSelect = (result: LocationResult) => {
    setQuery(result.displayName);
    setMapLat(result.lat);
    setMapLng(result.lng);
    setLatStr(result.lat.toFixed(6));
    setLngStr(result.lng.toFixed(6));
    setPublicLocation(result.displayName);
    onPublicLocationChange?.(result.displayName);
    setPinned(true);
    setOpen(false);
    setSuggestions([]);
    onSelect(result);
  };

  const handleLatChange = (val: string) => {
    setLatStr(val);
    const parsed = val.trim() === "" ? null : parseFloat(val);
    const valid = parsed !== null && !isNaN(parsed) && isFinite(parsed) ? parsed : null;
    setMapLat(valid);
    onCoordinatesChange?.(valid, mapLng);
  };

  const handleLngChange = (val: string) => {
    setLngStr(val);
    const parsed = val.trim() === "" ? null : parseFloat(val);
    const valid = parsed !== null && !isNaN(parsed) && isFinite(parsed) ? parsed : null;
    setMapLng(valid);
    onCoordinatesChange?.(mapLat, valid);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setMapLat(lat);
    setMapLng(lng);
    setLatStr(lat.toFixed(6));
    setLngStr(lng.toFixed(6));
    setPinned(true);
    onCoordinatesChange?.(lat, lng);
  };

  const handlePublicLocationChange = (val: string) => {
    setPublicLocation(val);
    onPublicLocationChange?.(val);
  };

  const coordInputClass =
    "h-9 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text shadow-sm outline-none transition focus:border-primary font-mono";

  return (
    <div className="space-y-2">
      {/* Search + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <MapPin
            size={14}
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors",
              pinned ? "text-primary" : "text-text-muted"
            )}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={placeholder}
            className="h-10 w-full rounded-lg border border-border bg-surface-elevated py-0 pl-8 pr-3 text-sm text-text shadow-sm outline-none transition focus:border-primary"
            autoComplete="off"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">…</span>
          )}
        </div>

        {/* Dropdown — z-[9999] to float above Leaflet layers */}
        {open && suggestions.length > 0 && (
          <ul className="absolute z-[9999] mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-lg">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-text hover:bg-surface-muted"
                >
                  <MapPin size={13} className="mt-0.5 shrink-0 text-text-muted" />
                  <span>{s.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map — click to place pin */}
      <LeafletMap lat={mapLat} lng={mapLng} onMapClick={handleMapClick} />

      {/* Editable lat / lon inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-text-muted">Lat</label>
          <input
            type="number"
            step="any"
            value={latStr}
            onChange={(e) => handleLatChange(e.target.value)}
            placeholder="e.g. 41.38879"
            className={coordInputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-text-muted">Lon</label>
          <input
            type="number"
            step="any"
            value={lngStr}
            onChange={(e) => handleLngChange(e.target.value)}
            placeholder="e.g. 2.15899"
            className={coordInputClass}
          />
        </div>
      </div>

      {/* Public location — shown to end users */}
      <div className="space-y-1">
        <label className="text-xs text-text-muted">Public location</label>
        <input
          type="text"
          value={publicLocation}
          onChange={(e) => handlePublicLocationChange(e.target.value)}
          placeholder="Shown to users (auto-filled from search)"
          className="h-10 w-full rounded-lg border border-border bg-surface-elevated py-0 px-3 text-sm text-text shadow-sm outline-none transition focus:border-primary"
        />
      </div>
    </div>
  );
}
