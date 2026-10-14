"use client";

import dynamic from "next/dynamic";

const ZonesMapInner = dynamic(
  () => import("@/components/sections/ZonesMapInner").then((m) => m.ZonesMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
        Chargement de la carte…
      </div>
    ),
  }
);

export function ZonesMapClient() {
  return <ZonesMapInner />;
}
