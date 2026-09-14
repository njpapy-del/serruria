"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { X, Upload } from "lucide-react";
import { saveSection } from "@/components/admin/SaveButton";

type Probleme = { id: string; label: string; photos: string[] };

const MAX_SLOTS = 3;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ProblemePhotos({ probleme, onChange }: { probleme: Probleme; onChange: (photos: string[]) => void }) {
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  async function handleFile(slotIndex: number, file: File) {
    setBusySlot(slotIndex);
    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await fetch("/api/admin/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemeId: probleme.id, slotIndex, dataUrl }),
      });
      if (res.ok) {
        const { path } = await res.json();
        const next = [...probleme.photos];
        next[slotIndex] = path;
        onChange(next);
      }
    } finally {
      setBusySlot(null);
    }
  }

  function removeSlot(slotIndex: number) {
    onChange(probleme.photos.filter((_, i) => i !== slotIndex));
  }

  const slots = Array.from({ length: Math.max(probleme.photos.length + 1, 1) }).slice(0, MAX_SLOTS);

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="font-semibold text-navy-800">{probleme.label}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {slots.map((_, slotIndex) => {
          const photo = probleme.photos[slotIndex];
          return (
            <div key={slotIndex} className="relative h-24 w-24 overflow-hidden rounded-lg bg-slate-100">
              {photo ? (
                <>
                  <Image src={photo} alt="" fill sizes="96px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removeSlot(slotIndex)}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-navy-900"
                    aria-label="Supprimer cette photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputs.current[slotIndex]?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400 hover:text-amber-600"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px]">Ajouter</span>
                </button>
              )}
              <input
                ref={(el) => {
                  fileInputs.current[slotIndex] = el;
                }}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(slotIndex, file);
                  e.target.value = "";
                }}
              />
              {busySlot === slotIndex ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs">
                  Envoi…
                </div>
              ) : null}
              {photo ? (
                <button
                  type="button"
                  onClick={() => fileInputs.current[slotIndex]?.click()}
                  className="absolute inset-x-0 bottom-0 bg-navy-950/70 py-0.5 text-[10px] text-white"
                >
                  Remplacer
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PhotosEditor({ initial }: { initial: Probleme[] }) {
  const [problemes, setProblemes] = useState(initial);

  async function updatePhotos(problemeId: string, photos: string[]) {
    const next = problemes.map((p) => (p.id === problemeId ? { ...p, photos } : p));
    setProblemes(next);
    await saveSection("problemes", next);
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-navy-900">Photos des problèmes</h2>
      <p className="mt-1 text-sm text-slate-500">
        Jusqu&apos;à 3 photos par carte (elles défilent automatiquement s&apos;il y en a plusieurs).
        Chaque ajout/suppression est enregistré immédiatement.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {problemes.map((probleme) => (
          <ProblemePhotos
            key={probleme.id}
            probleme={probleme}
            onChange={(photos) => updatePhotos(probleme.id, photos)}
          />
        ))}
      </div>
    </div>
  );
}
