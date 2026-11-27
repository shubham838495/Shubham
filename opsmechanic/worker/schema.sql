CREATE TABLE IF NOT EXISTS enquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  business   TEXT,
  email      TEXT NOT NULL,
  phone      TEXT,
  outlets    TEXT,
  need       TEXT,
  message    TEXT,
  ip         TEXT,
  country    TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_ip_time ON enquiries (ip, created_at);
