"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TarifsEditor } from "@/components/admin/TarifsEditor";
import { PhotosEditor } from "@/components/admin/PhotosEditor";
import { TextEditor } from "@/components/admin/TextEditor";
import { ContactEditor } from "@/components/admin/ContactEditor";
import { siteConfig } from "@/data/site-config";
import type content from "@/data/content.json";

type Content = typeof content;

const TABS = [
  { id: "tarifs", label: "Tarifs" },
  { id: "photos", label: "Photos" },
  { id: "textes", label: "Textes" },
  { id: "coordonnees", label: "Coordonnées" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminDashboard({ initialContent }: { initialContent: Content }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("tarifs");

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="container-srr flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
          <p className="font-bold text-navy-900">
            <span className="hidden sm:inline">Espace admin — </span>
            {siteConfig.brand.name}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex-shrink-0 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-navy-700"
          >
            Se déconnecter
          </button>
        </div>
      </div>

      <div className="container-srr py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                tab === t.id ? "bg-navy-900 text-white" : "bg-white text-navy-700 border border-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-6 card-elevated">
          {tab === "tarifs" ? <TarifsEditor initial={initialContent.tarifs} /> : null}
          {tab === "photos" ? <PhotosEditor initial={initialContent.problemes} /> : null}
          {tab === "textes" ? <TextEditor initial={initialContent} /> : null}
          {tab === "coordonnees" ? (
            <ContactEditor initialContact={initialContent.contact} initialLegal={initialContent.legal} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
