-- Annulation de 002 (retour à l'état 001).
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS opportunity_events;
UPDATE opportunities SET status = 'verifiee' WHERE status = 'a_contacter';
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_status_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_status_check
  CHECK (status IN ('nouvelle','verifiee','contactee','gagnee','perdue','non_pertinente'));
ALTER TABLE opportunities DROP COLUMN IF EXISTS motifs;
DROP TABLE IF EXISTS run_sources;
DROP TABLE IF EXISTS source_events;
DROP TABLE IF EXISTS sources;
DROP TABLE IF EXISTS admin_login_attempts;
