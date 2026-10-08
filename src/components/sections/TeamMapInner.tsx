"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import L, { type DivIcon, type Path } from "leaflet";
import { siteConfig } from "@/data/site-config";
import { departementsGeo, departementByCode } from "@/data/departements";

const DEPT_STYLE = { weight: 2, fillOpacity: 0.18 };
const DEPT_STYLE_HOVER = { weight: 3, fillOpacity: 0.35 };

const DEPT_BOUNDS = L.geoJSON(departementsGeo).getBounds();

function deptLabelIcon(code: string, color: string): DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
        transform:translate(-50%,-50%);display:inline-block;
        padding:2px 7px;border-radius:9999px;background:#fff;color:${color};
        border:2px solid ${color};font:800 12px system-ui,sans-serif;
        box-shadow:0 1px 4px rgba(0,0,0,.25);white-space:nowrap;
      ">${code}</div>`,
    iconSize: [0, 0],
  });
}

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
  const { technicians } = siteConfig.team;
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
        bounds={DEPT_BOUNDS}
        boundsOptions={{ padding: [12, 12] }}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={departementsGeo}
          style={(feature) => {
            const color = departementByCode(feature?.properties.code)?.color;
            return { ...DEPT_STYLE, color, fillColor: color };
          }}
          onEachFeature={(feature, layer) => {
            const dept = departementByCode(feature.properties.code);
            if (!dept) return;
            const lieu = siteConfig.villes.find((v) => v.slug === dept.slug)?.lieu ?? `à ${dept.nom}`;
            layer.bindTooltip(`${dept.nom} (${dept.code})`, { sticky: true });
            layer.bindPopup(
              `<strong>${dept.nom} (${dept.code})</strong><br/>` +
                (dept.slug ? `<a href="/serrurier/${dept.slug}">Serrurier ${lieu} →</a>` : "")
            );
            layer.on({
              mouseover: () => (layer as Path).setStyle(DEPT_STYLE_HOVER),
              mouseout: () => (layer as Path).setStyle(DEPT_STYLE),
            });
          }}
        />
        {departementsGeo.features.map((f) => (
          <Marker
            key={f.properties.code}
            position={f.properties.label}
            icon={deptLabelIcon(f.properties.code, departementByCode(f.properties.code)?.color ?? "#64748b")}
            interactive={false}
          />
        ))}
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
