"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

type Row = Record<string, unknown>;
type Vue = {
  intervalleAttenduMin: number;
  dernierPassage: Row | null;
  prochainPassagePrevu: string | null;
  passages24h: { attendus: number; executes: number; reussis: number };
  tauxReussite: number | null;
  moteurArrete: boolean;
  minutesDepuisDernier: number | null;
  sourcesParEtat: Record<string, number>;
};
type Couts = {
  parSource: Row[];
  tauxFauxPositifs: number | null;
  demandesExaminees: number;
  demandesConfirmees: number;
  interventionsRealisees: number;
  chiffreAffaires: number;
};
type Data =
  | { configured: false }
  | { configured: true; initialized: false }
  | {
      configured: true;
      observe: { aujourdhui: Row; opportunites: Row[]; parCommune: Row[]; delaiPublicationDetectionMedianMin: number | null };
      saisi: { interventions: Row[]; parCanal30j: Row[] };
      vue: Vue;
      couts: Couts;
    };

const ND = "Non disponible";
const RUN_STATUS: Record<string, string> = {
  SUCCESS_WITH_LEADS: "Demandes trouvées",
  SUCCESS_NO_RELEVANT_LEADS: "Recherche faite, rien de pertinent",
  SUCCESS_NO_RESULTS: "Recherche faite, aucun résultat",
  PARTIAL_SUCCESS: "Partiellement réussie",
  SEARCH_FAILED: "Recherche échouée",
  SOURCE_NOT_CONFIGURED: "Source non configurée",
  SOURCE_NOT_RUN: "Aucune recherche faite",
  EMAIL_FAILED: "Alerte non envoyée",
};
const ETAT: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-success-500/10 text-success-500" },
  IDLE: { label: "Inactive (aucun succès < 24 h)", cls: "bg-slate-100 text-slate-600" },
  ERROR: { label: "Erreur", cls: "bg-red-100 text-red-700" },
  PAUSED: { label: "En pause", cls: "bg-slate-100 text-slate-600" },
  NOT_CONFIGURED: { label: "Non configurée", cls: "bg-amber-100 text-amber-700" },
  AUTHORIZATION_REQUIRED: { label: "Autorisation requise", cls: "bg-amber-100 text-amber-700" },
  ACCESS_NOT_PERMITTED: { label: "Accès non autorisé", cls: "bg-red-50 text-red-600" },
};
const CLASSE: Record<string, string> = {
  DEMANDE_CONFIRMEE: "Demande explicite",
  DEMANDE_PROBABLE: "Demande potentielle",
  DEMANDE_DEVIS: "Demande de devis",
  RECHERCHE_PRO: "Recherche d'un professionnel",
  DEMANDE_SITE: "Formulaire du site",
};
const URGENCE: Record<string, string> = { ELEVEE: "Élevée", RAPIDE: "Rapide", NON_URGENTE: "Non urgente", DEVIS: "Devis" };
const OPP_STATUS: [string, string][] = [
  ["nouvelle", "À vérifier"],
  ["verifiee", "Vérifiée"],
  ["a_contacter", "À contacter"],
  ["contactee", "Contactée"],
  ["gagnee", "Intervention obtenue"],
  ["perdue", "Intervention perdue"],
  ["non_pertinente", "Non pertinente"],
];
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
const TABS = ["Vue d'ensemble", "Sources", "Journal", "Demandes", "Coûts", "Interventions", "Paramètres"] as const;
type Tab = (typeof TABS)[number];

const s = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }) : "—");
const fmtUtc = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");
const euros = (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
const dollars = (v: unknown) => `${Number(v ?? 0).toFixed(3)} $`;
const pct = (v: number | null) => (v === null ? ND : `${Math.round(v * 100)} %`);

function Card({ label, value, hint, alert }: { label: string; value: string | number; hint?: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${alert ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Table({ head, children, min = 640 }: { head: string[]; children: React.ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm" style={{ minWidth: min }}>
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {head.map((h) => (
              <th key={h} className="p-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail ?? json.error ?? `HTTP ${res.status}`);
  return json;
}

export function RadarDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("Vue d'ensemble");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api("/api/admin/radar"));
    } catch {
      setError("Impossible de charger le tableau de bord.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Chargement…</p>;

  if (!data.configured) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-navy-900">
        <p className="font-bold">Base de données non configurée</p>
        <p className="mt-2 text-sm">
          Le tableau de bord a besoin d&apos;une base Neon (offre gratuite), à créer par le titulaire du compte depuis
          Vercel → Storage → Neon (région Europe). Le robot continue d&apos;envoyer ses alertes par e-mail en attendant.
        </p>
      </div>
    );
  }
  if ("initialized" in data && !data.initialized) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <p className="font-bold text-navy-900">Base connectée mais pas encore initialisée</p>
        <button
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/admin/radar/migrate", { method: "POST" });
            } catch (e) {
              setError(String(e));
            }
            setBusy(false);
            load();
          }}
          disabled={busy}
          className="mt-3 rounded-full bg-navy-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "Initialisation…" : "Initialiser la base"}
        </button>
      </div>
    );
  }
  if (!("vue" in data)) {
    // Base en version 001 : appliquer la migration 002.
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <p className="font-bold text-navy-900">Mise à jour de la base nécessaire</p>
        <button onClick={() => api("/api/admin/radar/migrate", { method: "POST" }).then(load)} className="mt-3 rounded-full bg-navy-900 px-5 py-2 text-sm font-bold text-white">
          Appliquer les migrations
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections du Lead Radar">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-amber-500 text-navy-950" : "border border-slate-200 bg-white text-navy-700"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {tab === "Vue d'ensemble" ? <Overview data={data} /> : null}
      {tab === "Sources" ? <Sources onError={setError} /> : null}
      {tab === "Journal" ? <Journal /> : null}
      {tab === "Demandes" ? <Demandes rows={data.observe.opportunites} onChange={load} onError={setError} /> : null}
      {tab === "Coûts" ? <CoutsView couts={data.couts} delai={data.observe.delaiPublicationDetectionMedianMin} /> : null}
      {tab === "Interventions" ? <Interventions parCanal={data.saisi.parCanal30j} onSaved={load} onError={setError} /> : null}
      {tab === "Paramètres" ? <Parametres onError={setError} /> : null}
    </div>
  );
}

function Overview({ data }: { data: Extract<Data, { vue: Vue }> }) {
  const v = data.vue;
  const t = data.observe.aujourdhui;
  const last = v.dernierPassage;
  return (
    <div className="space-y-6">
      {v.moteurArrete ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 p-4 font-semibold text-red-700">
          ⚠ Robot probablement arrêté : {v.minutesDepuisDernier === null ? "aucun passage reçu" : `aucun passage depuis ${v.minutesDepuisDernier} min`} (attendu toutes les {v.intervalleAttenduMin} min).
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Dernier passage" value={last ? fmtDate(last.started_at) : ND} hint={last ? RUN_STATUS[String(last.status)] ?? String(last.status) : undefined} />
        <Card label="Prochain passage prévu" value={v.prochainPassagePrevu ? fmtDate(v.prochainPassagePrevu) : ND} hint="estimation (planification « au mieux »)" />
        <Card label="Passages 24 h" value={`${v.passages24h.executes} / ${v.passages24h.attendus}`} hint="exécutés / attendus" alert={v.passages24h.executes < v.passages24h.attendus / 2} />
        <Card label="Taux de réussite 24 h" value={pct(v.tauxReussite)} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Card label="Recherches aujourd'hui" value={Number(t.recherches ?? 0)} />
        <Card label="Publications examinées" value={Number(t.resultats ?? 0)} hint="pages et messages, pas des clients" />
        <Card label="Demandes pertinentes" value={Number(t.pertinentes ?? 0)} hint="à vérifier, pas des clients" />
        <Card label="Alertes acceptées" value={Number(t.alertes_acceptees ?? 0)} />
        <Card label="Alertes en échec" value={Number(t.alertes_echouees ?? 0)} alert={Number(t.alertes_echouees ?? 0) > 0} />
        <Card label="Coût API aujourd'hui" value={dollars(t.cout_usd)} />
      </div>
      <div>
        <h3 className="mb-2 font-bold text-navy-900">Sources par état</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(v.sourcesParEtat).map(([k, n]) => (
            <span key={k} className={`rounded-full px-3 py-1 text-sm font-semibold ${ETAT[k]?.cls ?? ""}`}>
              {ETAT[k]?.label ?? k} : {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sources({ onError }: { onError: (e: string) => void }) {
  const [d, setD] = useState<{ sources: Row[]; events: Row[] } | null>(null);
  const load = useCallback(() => api("/api/admin/radar/sources").then(setD).catch((e) => onError(String(e))), [onError]);
  useEffect(() => {
    load();
  }, [load]);
  if (!d) return <p className="text-slate-500">Chargement…</p>;
  return (
    <div className="space-y-6">
      <Table head={["Source", "État", "Accès", "Contient des demandes ?", "Dernière vérif.", "Dernier succès", "Requêtes 30 j", "Pertinents 30 j", "Coût 30 j", "Dernière erreur", "Action recommandée", "Activer"]} min={1300}>
        {d.sources.map((src) => {
          const etat = ETAT[String(src.etat)] ?? { label: String(src.etat), cls: "" };
          const err = src.derniere_erreur as Row | null;
          return (
            <tr key={String(src.id)} className="border-t border-slate-100 align-top">
              <td className="p-3 font-semibold">
                {s(src.nom)}
                <div className="text-xs font-normal text-slate-500">{s(src.categorie)}</div>
                {src.documentation ? (
                  <a href={String(src.documentation)} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 underline">
                    documentation
                  </a>
                ) : null}
              </td>
              <td className="p-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${etat.cls}`}>{etat.label}</span>
              </td>
              <td className="p-3 text-xs">{s(src.acces)}</td>
              <td className="p-3 text-xs">{s(src.contient_demandes)}</td>
              <td className="p-3">{fmtDate(src.derniere_verification)}</td>
              <td className="p-3">{fmtDate(src.dernier_succes)}</td>
              <td className="p-3">{s(src.requetes_30j)}</td>
              <td className="p-3">{s(src.pertinents_30j)}</td>
              <td className="p-3">{dollars(src.cout_30j)}</td>
              <td className="p-3 text-xs">{err ? `${fmtDate(err.started_at)} — ${s(err.error_kind)}` : "—"}</td>
              <td className="p-3 text-xs">
                {s(src.action_recommandee)}
                <div className="mt-1 text-slate-500">{s(src.limites)}</div>
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  aria-label={`Activer ${String(src.nom)}`}
                  checked={Boolean(src.enabled)}
                  disabled={!src.activable}
                  title={src.activable ? "" : "Non activable : source interdite, sans autorisation ou interne"}
                  onChange={(e) =>
                    api("/api/admin/radar/sources", { method: "PATCH", body: JSON.stringify({ id: src.id, enabled: e.target.checked }) })
                      .then(load)
                      .catch((err) => onError(String(err)))
                  }
                />
              </td>
            </tr>
          );
        })}
      </Table>
      <div>
        <h3 className="mb-2 font-bold text-navy-900">Historique des changements</h3>
        <Table head={["Date", "Source", "Avant", "Après", "Motif", "Par"]}>
          {d.events.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-3 text-slate-500">
                Aucun changement.
              </td>
            </tr>
          ) : null}
          {d.events.map((e, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="p-3">{fmtDate(e.at)}</td>
              <td className="p-3">{s(e.source_id)}</td>
              <td className="p-3">{s(e.ancien)}</td>
              <td className="p-3">{s(e.nouveau)}</td>
              <td className="p-3">{s(e.motif)}</td>
              <td className="p-3">{s(e.acteur)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

function Journal() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    api("/api/admin/radar/journal").then((j) => setRows(j.journal)).catch(() => setRows([]));
  }, []);
  if (!rows) return <p className="text-slate-500">Chargement…</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Aucun contenu de résultat Brave n&apos;est conservé : seulement nos requêtes et des métriques.</p>
      <Table head={["Passage", "UTC", "Paris", "Source", "Durée", "Requêtes prév./tent./OK/échec", "Résultats / écartés / qualifiés", "Statut", "Erreur", "Alertes", "Coût"]} min={1200}>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={11} className="p-3 text-slate-500">
              Aucun passage enregistré.
            </td>
          </tr>
        ) : null}
        {rows.map((r) => {
          const key = `${r.run_id}-${r.source_id}`;
          const queries = (r.queries as string[]) ?? [];
          return (
            <Fragment key={key}>
              <tr className="border-t border-slate-100 align-top">
                <td className="p-3 font-mono text-xs">{s(r.run_id)}</td>
                <td className="p-3 text-xs">{fmtUtc(r.started_at)}</td>
                <td className="p-3 text-xs">{fmtDate(r.started_at)}</td>
                <td className="p-3">{s(r.source_id)}</td>
                <td className="p-3">{r.duration_ms === null || r.duration_ms === undefined ? ND : `${(Number(r.duration_ms) / 1000).toFixed(1)} s`}</td>
                <td className="p-3">
                  {s(r.planned)} / {s(r.attempted)} / {s(r.succeeded)} / {s(r.failed)}
                </td>
                <td className="p-3">
                  {s(r.results)} / {s(r.rejected)} / {s(r.qualified)}
                </td>
                <td className="p-3 text-xs">{RUN_STATUS[String(r.status)] ?? s(r.status)}</td>
                <td className="p-3 text-xs">{s(r.error_kind)}{r.reason ? ` — ${s(r.reason)}` : ""}</td>
                <td className="p-3 text-xs">
                  {s(r.alerts_accepted)} acceptée(s){Number(r.alerts_failed) > 0 ? `, ${s(r.alerts_failed)} en échec` : ""}
                </td>
                <td className="p-3 text-xs" title={s(r.cost_method)}>
                  {dollars(r.cost_usd)}
                  {queries.length ? (
                    <button onClick={() => setOpen(open === key ? null : key)} className="ml-2 text-amber-600 underline">
                      requêtes
                    </button>
                  ) : null}
                </td>
              </tr>
              {open === key ? (
                <tr className="bg-slate-50">
                  <td colSpan={11} className="p-3 text-xs">
                    <strong>Requêtes exécutées :</strong> {queries.join(" · ")}
                    <div className="mt-1 text-slate-500">Méthode de coût : {s(r.cost_method)}</div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </Table>
    </div>
  );
}

function Demandes({ rows, onChange, onError }: { rows: Row[]; onChange: () => void; onError: (e: string) => void }) {
  const [f, setF] = useState({ source: "", classe: "", statut: "", dep: "", verif: false });
  const [hist, setHist] = useState<{ id: number; events: Row[] } | null>(null);
  const list = useMemo(
    () =>
      rows.filter(
        (o) =>
          (!f.source || o.source_id === f.source) &&
          (!f.classe || o.classe === f.classe) &&
          (!f.statut || o.status === f.statut) &&
          (!f.dep || o.departement === f.dep) &&
          (!f.verif || (o.status === "nouvelle" && (o.confiance !== "HAUTE" || o.classe === "DEMANDE_PROBABLE")))
      ),
    [rows, f]
  );
  const uniq = (k: string) => [...new Set(rows.map((r) => r[k]).filter(Boolean).map(String))].sort();
  const sel = (key: keyof typeof f, opts: string[], label: string, map?: Record<string, string>) => (
    <label className="text-xs">
      {label}
      <select value={String(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.value })} className="ml-1 rounded-lg border border-slate-300 px-2 py-1">
        <option value="">Tous</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {map?.[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {sel("source", uniq("source_id"), "Source")}
        {sel("classe", uniq("classe"), "Type", CLASSE)}
        {sel("statut", OPP_STATUS.map(([v]) => v), "Statut", Object.fromEntries(OPP_STATUS))}
        {sel("dep", uniq("departement"), "Département")}
        <label className="flex items-center gap-1 text-xs font-semibold">
          <input type="checkbox" checked={f.verif} onChange={(e) => setF({ ...f, verif: e.target.checked })} /> Vérification manuelle (cas ambigus)
        </label>
      </div>
      <Table head={["Détectée", "Publiée", "Source", "Type", "Besoin", "Urgence", "Confiance", "Zone", "Motifs du classement", "Lien", "Statut commercial"]} min={1300}>
        {list.length === 0 ? (
          <tr>
            <td colSpan={11} className="p-3 text-slate-500">
              Aucune demande pour ces filtres.
            </td>
          </tr>
        ) : null}
        {list.map((o) => (
          <tr key={String(o.id)} className="border-t border-slate-100 align-top">
            <td className="p-3">{fmtDate(o.detected_at)}</td>
            <td className="p-3">{o.published_at ? fmtDate(o.published_at) : "Date inconnue"}</td>
            <td className="p-3">{s(o.source_id)}</td>
            <td className="p-3">{CLASSE[String(o.classe)] ?? s(o.classe)}</td>
            <td className="p-3">{s(o.service)}</td>
            <td className="p-3">{o.niveau_urgence ? URGENCE[String(o.niveau_urgence)] ?? s(o.niveau_urgence) : "—"}</td>
            <td className="p-3">{s(o.confiance)}</td>
            <td className="p-3">{s(o.commune ?? (o.departement ? `Dép. ${o.departement}` : null))}</td>
            <td className="p-3 text-xs">{((o.motifs as string[]) ?? []).join(" · ") || "—"}</td>
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
                aria-label="Statut commercial"
                onChange={(e) =>
                  api("/api/admin/radar/opportunity", { method: "PATCH", body: JSON.stringify({ id: Number(o.id), status: e.target.value }) })
                    .then(onChange)
                    .catch((err) => onError(String(err)))
                }
                className="rounded-lg border border-slate-300 px-2 py-1"
              >
                {OPP_STATUS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                className="mt-1 block text-xs text-amber-600 underline"
                onClick={() => api(`/api/admin/radar/opportunity?id=${Number(o.id)}`).then((j) => setHist({ id: Number(o.id), events: j.events }))}
              >
                historique
              </button>
              {hist?.id === Number(o.id) ? (
                <ul className="mt-1 text-xs text-slate-600">
                  {hist.events.length === 0 ? <li>Aucune action.</li> : null}
                  {hist.events.map((e, i) => (
                    <li key={i}>
                      {fmtDate(e.at)} : {OPP_STATUS.find(([v]) => v === e.ancien)?.[1] ?? s(e.ancien)} → {OPP_STATUS.find(([v]) => v === e.nouveau)?.[1] ?? s(e.nouveau)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-slate-500">Une demande détectée n&apos;est pas un client : elle doit être vérifiée avant toute prise de contact.</p>
    </div>
  );
}

function CoutsView({ couts, delai }: { couts: Couts; delai: number | null }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card label="Taux de faux positifs (30 j)" value={pct(couts.tauxFauxPositifs)} hint={`sur ${couts.demandesExaminees} demande(s) examinée(s)`} />
        <Card label="Demandes confirmées (30 j)" value={couts.demandesConfirmees} hint="vérifiées par vous" />
        <Card label="Interventions réalisées (30 j)" value={couts.interventionsRealisees} hint="saisies à la main" />
        <Card label="Chiffre d'affaires (30 j)" value={couts.interventionsRealisees ? euros(couts.chiffreAffaires) : ND} />
        <Card label="Délai publication → détection" value={delai === null ? ND : `${delai} min`} hint="médiane 30 j" />
      </div>
      <Table head={["Source", "Requêtes (30 j)", "Demandes pertinentes", "Coût", "Coût par demande pertinente"]}>
        {couts.parSource.length === 0 ? (
          <tr>
            <td colSpan={5} className="p-3 text-slate-500">
              Aucune donnée.
            </td>
          </tr>
        ) : null}
        {couts.parSource.map((c) => (
          <tr key={String(c.source_id)} className="border-t border-slate-100">
            <td className="p-3">{s(c.source_id)}</td>
            <td className="p-3">{s(c.requetes)}</td>
            <td className="p-3">{s(c.pertinentes)}</td>
            <td className="p-3">{dollars(c.cout)}</td>
            <td className="p-3">{c.coutParPertinente === null ? "Non calculable (aucune demande pertinente)" : dollars(c.coutParPertinente)}</td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-slate-500">Aucun retour sur investissement n&apos;est affiché tant que les interventions et leur chiffre d&apos;affaires ne sont pas saisis.</p>
    </div>
  );
}

function Interventions({ parCanal, onSaved, onError }: { parCanal: Row[]; onSaved: () => void; onError: (e: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Seule source fiable des appels aboutis et du chiffre d&apos;affaires. Indiquez le canal d&apos;origine ou « Inconnu ».</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const num = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
          api("/api/admin/radar/intervention", {
            method: "POST",
            body: JSON.stringify({
              date_intervention: fd.get("date_intervention"),
              canal: fd.get("canal"),
              statut: fd.get("statut"),
              appel_recu: fd.get("appel_recu") === "on",
              montant_ttc: num("montant_ttc"),
              couts_directs: num("couts_directs"),
              note: fd.get("note") || null,
            }),
          })
            .then(() => {
              form.reset();
              onSaved();
            })
            .catch((err) => onError(`Saisie refusée : ${err}`));
        }}
        className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4"
      >
        <label className="text-sm">
          Date
          <input name="date_intervention" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" />
        </label>
        <label className="text-sm">
          Canal
          <select name="canal" defaultValue="inconnu" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
            {CANAUX.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Statut
          <select name="statut" defaultValue="realisee" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
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
      <Table head={["Canal (30 j)", "Appels reçus", "Interventions réalisées", "Chiffre d'affaires", "Coûts directs", "Marge"]}>
        {parCanal.length === 0 ? (
          <tr>
            <td colSpan={6} className="p-3 text-slate-500">
              Aucune intervention saisie.
            </td>
          </tr>
        ) : null}
        {parCanal.map((c) => (
          <tr key={String(c.canal)} className="border-t border-slate-100">
            <td className="p-3">{CANAUX.find(([v]) => v === c.canal)?.[1] ?? s(c.canal)}</td>
            <td className="p-3">{s(c.appels)}</td>
            <td className="p-3">{s(c.realisees)}</td>
            <td className="p-3">{euros(c.ca)}</td>
            <td className="p-3">{euros(c.couts)}</td>
            <td className="p-3 font-bold">{euros(c.marge)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Parametres({ onError }: { onError: (e: string) => void }) {
  const [st, setSt] = useState<Record<string, unknown> | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api("/api/admin/radar/settings")
      .then((j) => setSt(j.settings))
      .catch((e) => onError(String(e)));
  }, [onError]);
  if (!st) return <p className="text-slate-500">Chargement…</p>;
  const deps = ["75", "77", "78", "91", "92", "93", "94", "95"];
  const cur = (st.departements as string[]) ?? deps;
  return (
    <form
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const int = (k: string) => (fd.get(k) === "" || fd.get(k) === null ? undefined : Number(fd.get(k)));
        const body: Record<string, unknown> = {
          expected_interval_minutes: int("expected_interval_minutes"),
          bluesky_min_interval_minutes: int("bluesky_min_interval_minutes"),
          brave_max_queries_per_run: int("brave_max_queries_per_run"),
          brave_max_queries_per_day: int("brave_max_queries_per_day"),
          brave_rayon_prioritaire_km: int("brave_rayon_prioritaire_km"),
          notify_min_score: int("notify_min_score"),
          alerts_enabled: fd.get("alerts_enabled") === "on",
          departements: deps.filter((d) => fd.get(`dep_${d}`) === "on"),
          extra_keywords: String(fd.get("extra_keywords") ?? "")
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        };
        for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
        setSaved(false);
        api("/api/admin/radar/settings", { method: "PUT", body: JSON.stringify(body) })
          .then(() => setSaved(true))
          .catch((err) => onError(`Réglages refusés : ${err}`));
      }}
    >
      <p className="text-sm text-slate-500">Lus par le robot au début de chaque passage. Si le site est indisponible, il utilise sa configuration locale et le journalise.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {(
          [
            ["expected_interval_minutes", "Intervalle attendu entre passages (min)", 5, 1440, 60],
            ["bluesky_min_interval_minutes", "Bluesky : intervalle minimal (min)", 10, 1440, 10],
            ["brave_max_queries_per_run", "Brave : requêtes par passage (max 6)", 0, 6, 6],
            ["brave_max_queries_per_day", "Brave : requêtes par jour (max 24)", 0, 24, 24],
            ["brave_rayon_prioritaire_km", "Rayon prioritaire autour d'Aubervilliers (km)", 1, 50, 8],
            ["notify_min_score", "Score minimal d'alerte (0-100)", 0, 100, 45],
          ] as const
        ).map(([k, label, min, max, def]) => (
          <label key={k} className="text-sm">
            {label}
            <input name={k} type="number" min={min} max={max} defaultValue={String(st[k] ?? def)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" />
          </label>
        ))}
      </div>
      <fieldset className="text-sm">
        <legend className="font-semibold">Départements surveillés</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {deps.map((d) => (
            <label key={d} className="flex items-center gap-1">
              <input type="checkbox" name={`dep_${d}`} defaultChecked={cur.includes(d)} /> {d}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        Mots-clés supplémentaires (un par ligne, 20 max)
        <textarea name="extra_keywords" rows={3} defaultValue={((st.extra_keywords as string[]) ?? []).join("\n")} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="alerts_enabled" defaultChecked={st.alerts_enabled !== false} /> Alertes e-mail activées
      </label>
      <button type="submit" className="rounded-full bg-amber-500 px-5 py-2 font-bold text-navy-950">
        Enregistrer les réglages
      </button>
      {saved ? <p className="text-sm text-success-500">Réglages enregistrés : pris en compte au prochain passage.</p> : null}
    </form>
  );
}
