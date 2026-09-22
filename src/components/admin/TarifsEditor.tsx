"use client";

import { useState } from "react";
import { SaveButton, saveSection } from "@/components/admin/SaveButton";

type Tarif = { id: string; label: string; priceFrom: number | null; fixed: boolean; customText?: string };

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
        Prix vide → affiche « Sur devis » automatiquement. Cochez « prix fixe » pour un tarif
        garanti. Le texte personnalisé remplace toujours l&apos;affichage du prix s&apos;il est
        rempli (ex. « Sur devis selon modèle », « À partir de 150 € selon blindage »).
      </p>

      <div className="mt-4 space-y-3">
        {tarifs.map((tarif, index) => (
          <div key={tarif.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
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

            <label className="mt-3 block text-sm text-slate-600">
              Texte personnalisé (optionnel — remplace le prix ci-dessus si rempli)
              <input
                type="text"
                value={tarif.customText ?? ""}
                onChange={(e) => update(index, { customText: e.target.value })}
                placeholder="ex. Sur devis selon modèle"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        ))}
      </div>

      <SaveButton status={status} onClick={handleSave} />
    </div>
  );
}
