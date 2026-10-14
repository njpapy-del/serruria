"use client";

import { MapContainer, TileLayer, Marker, GeoJSON } from "react-leaflet";
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

/** Carte des départements desservis (contours colorés, cliquables). */
export function ZonesMapInner() {
  return (
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
    </MapContainer>
  );
}
