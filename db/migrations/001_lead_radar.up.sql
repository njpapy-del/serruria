-- Lead Radar : passages, opportunités, interventions.
-- Données minimales : aucune donnée personnelle de prospect (ni nom, ni téléphone,
-- ni texte de publication). Les résultats Brave ne sont JAMAIS stockés.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS radar_runs (
  run_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN (
    'SUCCESS_WITH_LEADS','SUCCESS_NO_RELEVANT_LEADS','SUCCESS_NO_RESULTS','PARTIAL_SUCCESS',
    'SEARCH_FAILED','SOURCE_NOT_CONFIGURED','SOURCE_NOT_RUN','EMAIL_FAILED')),
  queries_sent INTEGER NOT NULL DEFAULT 0,
  results INTEGER NOT NULL DEFAULT 0,
  relevant INTEGER NOT NULL DEFAULT 0,
  alerts_accepted INTEGER NOT NULL DEFAULT 0,
  alerts_failed INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  sources JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS radar_runs_started_idx ON radar_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS opportunities (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL CHECK (source_id <> 'brave_search'),
  key_hash TEXT NOT NULL UNIQUE,
  detected_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  classe TEXT NOT NULL,
  niveau_urgence TEXT,
  confiance TEXT,
  score INTEGER,
  service TEXT,
  commune TEXT,
  departement TEXT,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'nouvelle' CHECK (status IN ('nouvelle','verifiee','contactee','gagnee','perdue','non_pertinente')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opportunities_detected_idx ON opportunities (detected_at DESC);

CREATE TABLE IF NOT EXISTS interventions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_intervention DATE NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN ('google_ads','fiche_google','referencement_naturel','lead_radar','formulaire_site','whatsapp','bouche_a_oreille','autre','inconnu')),
  opportunity_id BIGINT REFERENCES opportunities(id) ON DELETE SET NULL,
  appel_recu BOOLEAN NOT NULL DEFAULT true,
  statut TEXT NOT NULL CHECK (statut IN ('planifiee','realisee','annulee')),
  montant_ttc NUMERIC(10,2) CHECK (montant_ttc IS NULL OR montant_ttc >= 0),
  couts_directs NUMERIC(10,2) CHECK (couts_directs IS NULL OR couts_directs >= 0),
  note TEXT CHECK (note IS NULL OR length(note) <= 500)
);
CREATE INDEX IF NOT EXISTS interventions_date_idx ON interventions (date_intervention DESC);
