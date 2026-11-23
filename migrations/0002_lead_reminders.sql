-- Daily overdue lead reminder: one successful reminder per UTC day.
-- No personal data is stored here.
CREATE TABLE IF NOT EXISTS lead_reminder_runs (
  day TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
