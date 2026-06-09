"use client";

interface MapPreviewProps {
  lat: number;
  lng: number;
  className?: string;
}

export function MapPreview({ lat, lng, className }: MapPreviewProps) {
  const delta = 0.008; // ~900m bounding box
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className={`overflow-hidden rounded-lg border border-border ${className ?? ""}`}>
      <iframe
        src={src}
        width="100%"
        height="220"
        style={{ border: 0, display: "block" }}
        loading="lazy"
        title="Location preview"
      />
    </div>
  );
}
