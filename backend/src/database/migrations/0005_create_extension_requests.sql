-- Up Migration
CREATE TABLE extension_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL,
  requested_seconds INT,
  status TEXT NOT NULL DEFAULT 'pending',
  granted_seconds INT,
  admin_note TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- An attempt should only ever have one pending extension request at a time.
-- Enforced here (not just in application code) so a race between two
-- concurrent requests can't both slip through as 'pending'.
CREATE UNIQUE INDEX idx_extension_requests_attempt_pending_unique
  ON extension_requests(attempt_id) WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX idx_extension_requests_attempt ON extension_requests(attempt_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_extension_requests_status ON extension_requests(status) WHERE deleted_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS extension_requests;
