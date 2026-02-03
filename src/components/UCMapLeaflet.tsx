"use client";

import { SCHOOL_TAGS, schoolIdToLabel, type SchoolId } from "@/lib/schools";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

// OpenStreetMap tile URL (no API key required)
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Approximate lat/lng for each UC campus
const UC_COORDS: Record<SchoolId, [number, number]> = {
  ucb: [37.8719, -122.2585],   // Berkeley
  ucd: [38.5382, -121.7617],   // Davis
  ucsc: [36.9914, -122.0609],  // Santa Cruz
  ucsb: [34.414, -119.8489],   // Santa Barbara
  ucla: [34.0689, -118.4452], // LA
  uci: [33.6405, -117.8443],   // Irvine
  ucr: [33.9734, -117.3281],   // Riverside
  ucsd: [32.8801, -117.234],   // San Diego
};

// Fix default marker icon in Next.js (avoids 404)
function useFixLeafletIcon() {
  useEffect(() => {
    const Default = L.Icon.Default as unknown as { prototype: { _getIconUrl?: unknown } };
    if (Default?.prototype?._getIconUrl) {
      delete Default.prototype._getIconUrl;
    }
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }, []);
}

type UCMapLeafletProps = {
  counts: Record<SchoolId, number>;
};

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function MapContent({ counts }: UCMapLeafletProps) {
  useFixLeafletIcon();
  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={OSM_ATTRIBUTION}
      />
      {SCHOOL_TAGS.map((t) => {
        const pos = UC_COORDS[t.id];
        if (!pos) return null;
        const count = counts[t.id] ?? 0;
        return (
          <CircleMarker
            key={t.id}
            center={pos}
            radius={8}
            pathOptions={{
              fillColor: "#3b82f6",
              color: "#fff",
              weight: 1.5,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -8]}>
              <span className="font-semibold">{schoolIdToLabel(t.id)}</span>
              <br />
              {count} post{count !== 1 ? "s" : ""}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

export function UCMapLeaflet({ counts }: UCMapLeafletProps) {
  // Center on California, zoom to fit all UCs
  const center: [number, number] = [36.5, -119.2];
  const zoom = 5;

  return (
    <div className="h-full min-h-[60vh] w-full overflow-hidden rounded-md">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full rounded-md"
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <MapResizeFix />
        <MapContent counts={counts} />
      </MapContainer>
    </div>
  );
}
