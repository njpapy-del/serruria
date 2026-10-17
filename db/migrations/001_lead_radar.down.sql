-- Annulation de 001 : supprime les tables du Lead Radar (aucune autre table touchée).
DROP TABLE IF EXISTS interventions;
DROP TABLE IF EXISTS opportunities;
DROP TABLE IF EXISTS radar_runs;
DELETE FROM schema_migrations WHERE version = '001_lead_radar';
