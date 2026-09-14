"use client";

import dynamic from "next/dynamic";

const TeamMapInner = dynamic(
  () => import("@/components/sections/TeamMapInner").then((m) => m.TeamMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
        Chargement de la carte…
      </div>
    ),
  }
);

export function TeamMapClient() {
  return <TeamMapInner />;
}
