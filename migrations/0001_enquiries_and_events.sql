-- Cloudflare D1. Apply only after creating a PRIVATE D1 database named portfolio-leads.
-- Enquiries contain personal data: restrict dashboard access and define a retention policy.
CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  project_type TEXT NOT NULL,
  budget TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS enquiries_created_idx ON enquiries(created_at);
CREATE TABLE IF NOT EXISTS event_counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, event)
);
