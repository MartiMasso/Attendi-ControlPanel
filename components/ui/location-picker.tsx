"use client";

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
  if (p.street) {
    parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
  }
  if (p.postcode) parts.push(p.postcode);
  const locality = p.city ?? p.town ?? p.village;
  if (locality) parts.push(locality);
  if (p.state) parts.push(p.state);
  if (p.country) parts.push(p.country);
  return parts.join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function searchLocations(query: string): Promise<LocationResult[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const p = f.properties;
    const locality = p.city ?? p.town ?? p.village;
    return {
      displayName: buildDisplayName(p, lat, lng),
      lat,
      lng,
      street: p.street,
      houseNumber: p.housenumber,
      city: locality,
      postcode: p.postcode,
      country: p.country
    };
  });
}

interface LocationPickerProps {
  onSelect: (result: LocationResult) => void;
  placeholder?: string;
  initialValue?: string;
}

export function LocationPicker({ onSelect, placeholder = "Search address…", initialValue = "" }: LocationPickerProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(false);
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
    setSelected(false);

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
    setSelected(true);
    setOpen(false);
    setSuggestions([]);
    onSelect(result);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          size={14}
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2",
            selected ? "text-primary" : "text-text-muted"
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

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-card">
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
  );
}
