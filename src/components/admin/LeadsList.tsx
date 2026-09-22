"use client";

import { useEffect, useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";

type Lead = {
  nom: string;
  telephone: string;
  ville: string;
  probleme: string;
  message: string;
  receivedAt: string;
  url: string;
};

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads", { cache: "no-store" });
      const data = await res.json();
      if (data.error === "blob_not_configured") {
        setError(
          "Le stockage des leads n'est pas encore configuré (Vercel Blob). Créez un store Blob dans Vercel → Storage, puis reconnectez-le au projet."
        );
        setLeads([]);
      } else if (!res.ok) {
        setError("Impossible de récupérer les leads pour le moment.");
        setLeads([]);
      } else {
        setLeads(data.leads);
      }
    } catch {
      setError("Impossible de récupérer les leads pour le moment.");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(url: string) {
    if (!confirm("Supprimer définitivement ce lead ?")) return;
    await fetch("/api/admin/leads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setLeads((prev) => prev?.filter((l) => l.url !== url) ?? null);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-900">
          Leads {leads ? `(${leads.length})` : ""}
        </h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Demandes de rappel envoyées depuis le formulaire du site.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-navy-800">
          {error}
        </p>
      ) : null}

      {leads && leads.length === 0 && !error ? (
        <p className="mt-4 text-sm text-slate-500">Aucun lead reçu pour l&apos;instant.</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {leads?.map((lead) => (
          <div key={lead.url} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-navy-900">{lead.nom}</p>
                <p className="text-sm text-slate-500">
                  {new Date(lead.receivedAt).toLocaleString("fr-FR")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(lead.url)}
                aria-label="Supprimer ce lead"
                className="text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid gap-1 text-sm text-navy-700 sm:grid-cols-2">
              <p>
                <span className="font-semibold">Téléphone :</span>{" "}
                <a href={`tel:${lead.telephone}`} className="text-amber-600 hover:underline">
                  {lead.telephone}
                </a>
              </p>
              <p>
                <span className="font-semibold">Ville :</span> {lead.ville}
              </p>
              <p>
                <span className="font-semibold">Problème :</span> {lead.probleme}
              </p>
            </div>
            {lead.message ? (
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-semibold">Message :</span> {lead.message}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
