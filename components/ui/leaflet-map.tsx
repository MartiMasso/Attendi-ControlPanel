"use client";

import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Fix default icon paths broken by webpack
const PIN = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const DEFAULT_CENTER: [number, number] = [40.416, -3.703];
const DEFAULT_ZOOM = 5;
const SELECTED_ZOOM = 15;

function MapController({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  const mounted = useRef(false);

  useEffect(() => {
    if (lat === null || lng === null) return;
    if (!mounted.current) {
      mounted.current = true;
      map.setView([lat, lng], SELECTED_ZOOM);
    } else {
      map.flyTo([lat, lng], SELECTED_ZOOM, { duration: 0.7 });
    }
  }, [map, lat, lng]);

  return null;
}

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

interface LeafletMapProps {
  lat: number | null;
  lng: number | null;
  onMapClick?: (lat: number, lng: number) => void;
}

export function LeafletMap({ lat, lng, onMapClick }: LeafletMapProps) {
  return (
    <MapContainer
      center={lat !== null && lng !== null ? [lat, lng] : DEFAULT_CENTER}
      zoom={lat !== null ? SELECTED_ZOOM : DEFAULT_ZOOM}
      style={{ height: "240px", width: "100%", zIndex: 0, cursor: onMapClick ? "crosshair" : undefined }}
      className="rounded-lg border border-border"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {lat !== null && lng !== null && (
        <Marker position={[lat, lng]} icon={PIN} />
      )}
      <MapController lat={lat} lng={lng} />
      <ClickHandler onMapClick={onMapClick} />
    </MapContainer>
  );
}
