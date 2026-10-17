"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Row = Record<string, string | number | boolean | null>;
type Data =
  | { configured: false }
  | { configured: true; initialized: false }
  | {
      configured: true;
      observe: {
        aujourdhui: Row;
        dernierPassage: Row | null;
        statuts7j: Row[];
        passages: Row[];
        opportunites: Row[];
        parCommune: Row[];
        parSource: Row[];
        delaiPublicationDetectionMedianMin: number | null;
      };
      saisi: { interventions: Row[]; parCanal30j: Row[] };
    };

const STATUS_LABEL: Record<string, string> = {
  SUCCESS_WITH_LEADS: "Demandes trouvées",
  SUCCESS_NO_RELEVANT_LEADS: "Recherche faite, rien de pertinent",
  SUCCESS_NO_RESULTS: "Recherche faite, aucun résultat",
  PARTIAL_SUCCESS: "Partiellement réussie",
  SEARCH_FAILED: "Recherche échouée",
  SOURCE_NOT_CONFIGURED: "Source non configurée",
  SOURCE_NOT_RUN: "Aucune recherche faite",
  EMAIL_FAILED: "Alerte non envoyée",
};
const OK = new Set(["SUCCESS_WITH_LEADS", "SUCCESS_NO_RELEVANT_LEADS", "SUCCESS_NO_RESULTS"]);
const CANAUX: [string, string][] = [
  ["google_ads", "Google Ads"],
  ["fiche_google", "Fiche Google"],
  ["referencement_naturel", "Référencement naturel"],
  ["lead_radar", "Lead Radar"],
  ["formulaire_site", "Formulaire du site"],
  ["whatsapp", "WhatsApp"],
  ["bouche_a_oreille", "Bouche-à-oreille"],
  ["autre", "Autre"],
  ["inconnu", "Inconnu"],
];
const OPP_STATUS: [string, string][] = [
  ["nouvelle", "Nouvelle"],
  ["verifiee", "Vérifiée"],
  ["contactee", "Contactée"],
  ["gagnee", "Gagnée"],
  ["perdue", "Perdue"],
  ["non_pertinente", "Non pertinente"],
];

const URGENCE: Record<string, string> = { ELEVEE: "Élevée", RAPIDE: "Rapide", NON_URGENTE: "Non urgente", DEVIS: "Devis" };

const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }) : "—");
const euros = (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function RadarDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/radar", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Impossible de charger le tableau de bord.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function initDb() {
    setBusy(true);
    const res = await fetch("/api/admin/radar/migrate", { method: "POST" });
    setBusy(false);
    if (!res.ok) setError("Initialisation de la base impossible.");
    load();
  }

  async function setStatus(id: number, status: string) {
    const res = await fetch("/api/admin/radar/opportunity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) setError("Mise à jour impossible.");
    load();
  }

  async function addIntervention(form: HTMLFormElement) {
    const f = new FormData(form);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    const res = await fetch("/api/admin/radar/intervention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date_intervention: f.get("date_intervention"),
        canal: f.get("canal"),
        statut: f.get("statut"),
        appel_recu: f.get("appel_recu") === "on",
        montant_ttc: num("montant_ttc"),
        couts_directs: num("couts_directs"),
        note: f.get("note") || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(`Saisie refusée : ${j.detail ?? "erreur"}`);
      return;
    }
    form.reset();
    load();
  }

  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Chargement…</p>;

  if (!data.configured) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-navy-900">
        <p className="font-bold">Base de données non configurée</p>
        <p className="mt-2 text-sm">
          Le tableau de bord a besoin d&apos;une base Neon (offre gratuite). Créez-la depuis Vercel → Storage →
          Neon (région Europe), connectée au projet. Le robot continue d&apos;envoyer ses alertes par e-mail en
          attendant.
        </p>
      </div>
    );
  }
  if ("initialized" in data && !data.initialized) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <p className="font-bold text-navy-900">Base connectée mais pas encore initialisée</p>
        <button onClick={initDb} disabled={busy} className="mt-3 rounded-full bg-navy-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "Initialisation…" : "Initialiser la base"}
        </button>
      </div>
    );
  }
  if (!("observe" in data)) return null;

  const { observe, saisi } = data;
  const t = observe.aujourdhui;
  const last = observe.dernierPassage;
  const lastAgeMin = last ? Math.round((Date.now() - new Date(String(last.started_at)).getTime()) / 60000) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Dernier passage : <strong className="text-navy-900">{fmtDate(last?.started_at)}</strong>
            {lastAgeMin !== null ? ` (il y a ${lastAgeMin} min)` : ""} —{" "}
            <span className={last && OK.has(String(last.status)) ? "text-success-500" : "text-red-600"}>
              {last ? STATUS_LABEL[String(last.status)] ?? String(last.status) : "aucun passage reçu"}
            </span>
          </p>
          {lastAgeMin !== null && lastAgeMin > 60 ? (
            <p className="text-sm font-semibold text-red-600">⚠ Aucun passage depuis plus d&apos;une heure : vérifier le serveur.</p>
          ) : null}
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section>
        <h3 className="mb-3 text-lg font-bold text-navy-900">Aujourd&apos;hui — mesuré par le robot</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Card label="Passages" value={Number(t.passages ?? 0)} />
          <Card label="Recherches" value={Number(t.recherches ?? 0)} />
          <Card label="Résultats" value={Number(t.resultats ?? 0)} hint="pages et messages trouvés" />
          <Card label="Demandes pertinentes" value={Number(t.pertinentes ?? 0)} hint="ce ne sont pas des clients" />
          <Card label="Alertes acceptées" value={Number(t.alertes_acceptees ?? 0)} />
          <Card label="Alertes en échec" value={Number(t.alertes_echouees ?? 0)} />
          <Card label="Coût API" value={`${Number(t.cout_usd ?? 0).toFixed(3)} $`} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Délai médian publication → détection (30 j) :{" "}
          {observe.delaiPublicationDetectionMedianMin === null ? "non mesurable (aucune date de publication)" : `${observe.delaiPublicationDetectionMedianMin} min`}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 font-bold text-navy-900">Statuts des passages (7 j)</h3>
          <ul className="space-y-1 text-sm">
            {observe.statuts7j.length === 0 ? <li className="text-slate-500">Aucun passage.</li> : null}
            {observe.statuts7j.map((s) => (
              <li key={String(s.status)} className="flex justify-between gap-2">
                <span>{STATUS_LABEL[String(s.status)] ?? String(s.status)}</span>
                <strong>{String(s.n)}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-bold text-navy-900">Demandes par zone (30 j)</h3>
          <ul className="space-y-1 text-sm">
            {observe.parCommune.length === 0 ? <li className="text-slate-500">Aucune demande.</li> : null}
            {observe.parCommune.map((c) => (
              <li key={String(c.zone)} className="flex justify-between gap-2">
                <span>{String(c.zone)}</span>
                <strong>{String(c.n)}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-bold text-navy-900">Demandes par source (30 j)</h3>
          <ul className="space-y-1 text-sm">
            {observe.parSource.length === 0 ? <li className="text-slate-500">Aucune demande.</li> : null}
            {observe.parSource.map((c) => (
              <li key={String(c.source_id)} className="flex justify-between gap-2">
                <span>{String(c.source_id)}</span>
                <strong>{String(c.n)}</strong>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Les résultats Brave ne sont jamais conservés (conditions du fournisseur).</p>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-navy-900">Demandes détectées</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Détectée</th>
                <th className="p-3">Source</th>
                <th className="p-3">Type</th>
                <th className="p-3">Urgence</th>
                <th className="p-3">Zone</th>
                <th className="p-3">Lien</th>
                <th className="p-3">Suivi</th>
              </tr>
            </thead>
            <tbody>
              {observe.opportunites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-slate-500">
                    Aucune demande détectée pour l&apos;instant.
                  </td>
                </tr>
              ) : null}
              {observe.opportunites.map((o) => (
                <tr key={String(o.id)} className="border-t border-slate-100">
                  <td className="p-3">{fmtDate(o.detected_at)}</td>
                  <td className="p-3">{String(o.source_id)}</td>
                  <td className="p-3">{String(o.service ?? o.classe)}</td>
                  <td className="p-3">{o.niveau_urgence ? URGENCE[String(o.niveau_urgence)] ?? String(o.niveau_urgence) : "—"}</td>
                  <td className="p-3">{String(o.commune ?? (o.departement ? `Dép. ${o.departement}` : "—"))}</td>
                  <td className="p-3">
                    {o.url ? (
                      <a href={String(o.url)} target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">
                        Ouvrir
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <select
                      value={String(o.status)}
                      onChange={(e) => setStatus(Number(o.id), e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1"
                      aria-label="Statut de la demande"
                    >
                      {OPP_STATUS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-lg font-bold text-navy-900">Appels et interventions — saisis à la main</h3>
        <p className="mb-3 text-sm text-slate-500">
          Seule source fiable des appels aboutis et du chiffre d&apos;affaires. Indiquez le canal d&apos;origine
          (« Comment nous avez-vous trouvé ? ») ou « Inconnu ».
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addIntervention(e.currentTarget);
          }}
          className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4"
        >
          <label className="text-sm">
            Date
            <input name="date_intervention" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" />
          </label>
          <label className="text-sm">
            Canal
            <select name="canal" required defaultValue="inconnu" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
              {CANAUX.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Statut
            <select name="statut" required defaultValue="realisee" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
              <option value="planifiee">Planifiée</option>
              <option value="realisee">Réalisée</option>
              <option value="annulee">Annulée</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input name="appel_recu" type="checkbox" defaultChecked /> Appel reçu
          </label>
          <label className="text-sm">
            Montant TTC (€)
            <input name="montant_ttc" type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" />
          </label>
          <label className="text-sm">
            Coûts directs (€)
            <input name="couts_directs" type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" />
          </label>
          <label className="col-span-2 text-sm">
            Note (sans données personnelles)
            <input name="note" maxLength={500} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" />
          </label>
          <button type="submit" className="col-span-2 rounded-full bg-amber-500 px-5 py-2 font-bold text-navy-950 md:col-span-4">
            Enregistrer
          </button>
        </form>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Canal (30 j)</th>
                <th className="p-3">Appels reçus</th>
                <th className="p-3">Interventions réalisées</th>
                <th className="p-3">Chiffre d&apos;affaires</th>
                <th className="p-3">Coûts directs</th>
                <th className="p-3">Marge</th>
              </tr>
            </thead>
            <tbody>
              {saisi.parCanal30j.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-slate-500">
                    Aucune intervention saisie.
                  </td>
                </tr>
              ) : null}
              {saisi.parCanal30j.map((c) => (
                <tr key={String(c.canal)} className="border-t border-slate-100">
                  <td className="p-3">{CANAUX.find(([v]) => v === c.canal)?.[1] ?? String(c.canal)}</td>
                  <td className="p-3">{String(c.appels)}</td>
                  <td className="p-3">{String(c.realisees)}</td>
                  <td className="p-3">{euros(c.ca)}</td>
                  <td className="p-3">{euros(c.couts)}</td>
                  <td className="p-3 font-bold">{euros(c.marge)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-navy-900">Derniers passages</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Début</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Recherches</th>
                <th className="p-3">Résultats</th>
                <th className="p-3">Pertinentes</th>
                <th className="p-3">Alertes</th>
              </tr>
            </thead>
            <tbody>
              {observe.passages.map((r) => (
                <tr key={String(r.run_id)} className="border-t border-slate-100">
                  <td className="p-3">{fmtDate(r.started_at)}</td>
                  <td className={`p-3 ${OK.has(String(r.status)) ? "" : "font-semibold text-red-600"}`}>{STATUS_LABEL[String(r.status)] ?? String(r.status)}</td>
                  <td className="p-3">{String(r.queries_sent)}</td>
                  <td className="p-3">{String(r.results)}</td>
                  <td className="p-3">{String(r.relevant)}</td>
                  <td className="p-3">{String(r.alerts_accepted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
