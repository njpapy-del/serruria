-- Registre des sources, journal par source, historiques, réglages, tentatives de connexion.
-- Aucun contenu de résultat Brave : seulement nos requêtes et des métriques.

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_login_attempts_idx ON admin_login_attempts (ip_hash, at DESC);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL,
  acces TEXT NOT NULL,
  etat_base TEXT NOT NULL CHECK (etat_base IN ('ACTIVE','NOT_CONFIGURED','AUTHORIZATION_REQUIRED','ACCESS_NOT_PERMITTED')),
  activable BOOLEAN NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  contient_demandes TEXT NOT NULL,
  documentation TEXT,
  limites TEXT NOT NULL,
  action_recommandee TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT enabled OR activable OR id = 'site_form')
);

CREATE TABLE IF NOT EXISTS source_events (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ancien TEXT,
  nouveau TEXT NOT NULL,
  motif TEXT NOT NULL,
  acteur TEXT NOT NULL CHECK (acteur IN ('admin','robot','systeme'))
);
CREATE INDEX IF NOT EXISTS source_events_idx ON source_events (source_id, at DESC);

CREATE TABLE IF NOT EXISTS run_sources (
  run_id TEXT NOT NULL REFERENCES radar_runs(run_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  planned INTEGER NOT NULL DEFAULT 0,
  attempted INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  results INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  qualified INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  error_kind TEXT,
  reason TEXT,
  queries JSONB NOT NULL DEFAULT '[]'::jsonb,
  lieux_couverts INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  cost_method TEXT NOT NULL,
  PRIMARY KEY (run_id, source_id)
);
CREATE INDEX IF NOT EXISTS run_sources_started_idx ON run_sources (started_at DESC);

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS motifs JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_status_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_status_check
  CHECK (status IN ('nouvelle','verifiee','a_contacter','contactee','gagnee','perdue','non_pertinente'));

CREATE TABLE IF NOT EXISTS opportunity_events (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ancien TEXT,
  nouveau TEXT NOT NULL,
  acteur TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS opportunity_events_idx ON opportunity_events (opportunity_id, at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registre initial (vérifié le 2026-10-17). Une source interdite ou sans autorisation n'est pas activable.
INSERT INTO sources (id, nom, categorie, acces, etat_base, activable, enabled, contient_demandes, documentation, limites, action_recommandee) VALUES
 ('bluesky','Bluesky (recherche publique)','Réseau social public','API officielle (AppView)','ACTIVE',true,true,'Messages publics ; demandes réelles rares','https://docs.bsky.app/docs/api/app-bsky-feed-search-posts','Réponses automatiques = spam (règles Bluesky) ; blocages possibles depuis des serveurs de centres de données','Aucune'),
 ('brave_search','Brave Search API','Moteur de recherche','API officielle payante (crédit gratuit 5 $/mois)','ACTIVE',true,true,'Surtout concurrents, annuaires, articles ; indexation avec plusieurs jours de retard','https://brave.com/search/api/','Conservation des résultats interdite (stockage transitoire) ; aucun plafond côté Brave : plafond appliqué par le robot','Aucune'),
 ('alertes_rss','Alertes web (flux RSS)','Flux','RSS (Google Alerts, Talkwalker)','NOT_CONFIGURED',true,true,'Pages nouvellement indexées','https://www.google.com/alerts','Retard d''indexation ; aucun droit de publier sur les pages trouvées','Créer des alertes « Flux RSS » et renseigner RADAR_RSS_FEEDS'),
 ('site_form','Formulaire du site','Interne','Formulaire serrurerielouisfils.com','ACTIVE',false,true,'Oui : vraies demandes','https://serrurerielouisfils.com/#lead-form','—','Aucune'),
 ('search_console','Google Search Console','Données du site','API officielle (compte de service)','AUTHORIZATION_REQUIRED',false,false,'Non : requêtes ayant affiché le site (agrégées, 2-3 j de retard)','https://developers.google.com/webmaster-tools','Ne donne ni les recherches des internautes ni leur identité','Valider le site dans Search Console puis fournir un compte de service'),
 ('google_business_profile','Google Business Profile (performances)','Fiche d''établissement','API officielle (accès à demander)','AUTHORIZATION_REQUIRED',false,false,'Non : clics « Appeler », itinéraires, mots-clés mensuels','https://developers.google.com/my-business/reference/performance/rest','Pas de flux de prospects ; données quotidiennes','Demander l''accès API et communiquer la fiche'),
 ('google_search','Résultats Google (extraction)','Moteur de recherche','Aucun accès autorisé','ACCESS_NOT_PERMITTED',false,false,'—','https://developers.google.com/custom-search/v1/overview','Extraction interdite ; API Custom Search fermée aux nouveaux clients','Aucune (utiliser Brave ou Search Console)'),
 ('pagesjaunes','PagesJaunes','Annuaire de professionnels','Aucune API publique ; protection anti-robot (403)','ACCESS_NOT_PERMITTED',false,false,'Non : fiches de professionnels (concurrents)','https://www.pagesjaunes.fr/','robots.txt interdit les fiches ; base protégée (CPI art. L342)','Soigner manuellement la fiche de l''entreprise'),
 ('devis_plus','Devis Plus','Plateforme de mise en relation','Webservice partenaire (contrat)','ACCESS_NOT_PERMITTED',false,false,'Demandes non publiques, transmises à ≤ 5 partenaires ; serrurerie non couverte','https://www.devis-plus.com/conditions-generales-dutilisation-de-la-plateforme/','CGU art. 7.2 et 9.2 : robots et extraction interdits','Contrat partenaire uniquement (intérêt faible : serrurerie absente)'),
 ('allovoisins','AlloVoisins','Plateforme de demandes','Compte professionnel (manuel)','ACCESS_NOT_PERMITTED',false,false,'Oui, demandes de particuliers (accès pro)','https://www.allovoisins.com/','Bloque les robots','Évaluer un compte pro (essai) et répondre à la main'),
 ('leboncoin','Leboncoin','Petites annonces','Aucun accès autorisé','ACCESS_NOT_PERMITTED',false,false,'—','https://www.leboncoin.fr/','Extraction condamnée (affaire Jinka, 2024)','Aucune'),
 ('facebook_groupes','Groupes Facebook','Réseau social','API des groupes supprimée (2024)','ACCESS_NOT_PERMITTED',false,false,'Parfois, dans des groupes de quartier','https://developers.facebook.com/','Aucune lecture automatisée possible','Réponse manuelle si les règles du groupe le permettent'),
 ('x_twitter','X (Twitter)','Réseau social','API payante','ACCESS_NOT_PERMITTED',false,false,'Rare','https://docs.x.com/','Réponses automatiques non sollicitées interdites','Aucune'),
 ('reddit','Reddit','Forums','API commerciale sur accord','ACCESS_NOT_PERMITTED',false,false,'Rare','https://www.reddit.com/wiki/api','Usage commercial sur accord payant','Aucune')
ON CONFLICT (id) DO NOTHING;
