"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L, { type DivIcon } from "leaflet";
import { siteConfig } from "@/data/site-config";

const STATUS_COLOR: Record<string, string> = {
  disponible: "#16a34a",
  intervention: "#f59e0b",
};

function markerIcon(tech: (typeof siteConfig.team.technicians)[number]): DivIcon {
  const color = STATUS_COLOR[tech.status];
  return L.divIcon({
    className: "",
    html: `<div style="
        width:32px;height:32px;border-radius:9999px;
        background:${color};color:#fff;font:700 11px system-ui,sans-serif;
        display:flex;align-items:center;justify-content:center;
        border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
      ">${tech.initials}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const REFRESH_SECONDS = 45;

export function TeamMapInner() {
  const { technicians, mapCenter, mapZoom } = siteConfig.team;
  const disponibles = technicians.filter((t) => t.status === "disponible").length;
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((s) => (s <= 1 ? REFRESH_SECONDS : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={mapZoom}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {technicians.map((tech) => (
          <Marker key={tech.name} position={[tech.lat, tech.lng]} icon={markerIcon(tech)}>
            <Popup>
              <strong>{tech.name}</strong>
              <br />
              {tech.zone}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Légende */}
      <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success-500" /> Disponible
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> En intervention
        </div>
      </div>

      {/* Compteur */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex items-center gap-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-navy-800 shadow-md">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success-500" />
          {disponibles} disponibles
        </span>
        <span className="text-slate-400">Màj dans {countdown}s</span>
      </div>
    </div>
  );
}
