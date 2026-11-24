CREATE TABLE witness_requests (
  id TEXT PRIMARY KEY NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  active_phone TEXT UNIQUE,
  relationship TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'rejected')),
  slot INTEGER UNIQUE CHECK(slot IS NULL OR slot BETWEEN 1 AND 4),
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  CHECK((status = 'verified' AND slot IS NOT NULL) OR (status != 'verified' AND slot IS NULL))
);
--> statement-breakpoint
CREATE INDEX witness_status_idx ON witness_requests(status, created_at);
