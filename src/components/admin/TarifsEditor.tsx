"use client";

import { useState } from "react";
import { SaveButton, saveSection } from "@/components/admin/SaveButton";

type Tarif = { id: string; label: string; priceFrom: number | null; fixed: boolean };

export function TarifsEditor({ initial }: { initial: Tarif[] }) {
  const [tarifs, setTarifs] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function update(index: number, patch: Partial<Tarif>) {
    setTarifs((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    const ok = await saveSection("tarifs", tarifs);
    setStatus(ok ? "saved" : "error");
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-navy-900">Tarifs</h2>
      <p className="mt-1 text-sm text-slate-500">
        Laisser le prix vide affiche « À partir de XX € ». Cochez « prix fixe » pour un tarif garanti.
      </p>

      <div className="mt-4 space-y-3">
        {tarifs.map((tarif, index) => (
          <div
            key={tarif.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4"
          >
            <span className="min-w-[180px] font-semibold text-navy-800">{tarif.label}</span>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              Prix (€)
              <input
                type="number"
                min={0}
                value={tarif.priceFrom ?? ""}
                onChange={(e) =>
                  update(index, { priceFrom: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-24 rounded-lg border border-slate-300 px-2 py-1"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={tarif.fixed}
                onChange={(e) => update(index, { fixed: e.target.checked })}
              />
              Prix fixe
            </label>
          </div>
        ))}
      </div>

      <SaveButton status={status} onClick={handleSave} />
    </div>
  );
}
