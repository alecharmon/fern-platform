-- Billing plan overrides set by super admins
CREATE TABLE org_billing_override (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  sku         TEXT NOT NULL,
  added_by    TEXT NOT NULL,
  start_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date    TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ
);

-- Index for querying active overrides by org
CREATE INDEX idx_org_billing_override_org_id ON org_billing_override (org_id);
