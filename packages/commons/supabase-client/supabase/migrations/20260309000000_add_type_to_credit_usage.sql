-- Add type column to org_fern_credit_usage for per-type billing queries
-- and update indexes on both tables to support type-filtered time-range queries

-- Step 1: Add type column with temporary default for existing rows
ALTER TABLE "public"."org_fern_credit_usage"
    ADD COLUMN "type" "text" NOT NULL DEFAULT 'ask_fern';

-- Step 2: Drop the default (all new inserts must supply type explicitly)
ALTER TABLE "public"."org_fern_credit_usage"
    ALTER COLUMN "type" DROP DEFAULT;

-- Step 3: New indexes on org_fern_credit_usage for type-based queries
CREATE INDEX IF NOT EXISTS "idx_org_fern_credit_usage_org_type_created"
    ON "public"."org_fern_credit_usage" USING "btree" ("org_id", "type", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_org_fern_credit_usage_org_site_type_created"
    ON "public"."org_fern_credit_usage" USING "btree" ("org_id", "site", "type", "created_at" DESC);

-- Step 4: Replace (org_id, type) with (org_id, type, created_at DESC) on org_activity_log
-- The composite covers equality-only queries on (org_id, type) as a prefix
DROP INDEX IF EXISTS "idx_org_activity_log_org_type";

CREATE INDEX IF NOT EXISTS "idx_org_activity_log_org_type_created"
    ON "public"."org_activity_log" USING "btree" ("org_id", "type", "created_at" DESC);
