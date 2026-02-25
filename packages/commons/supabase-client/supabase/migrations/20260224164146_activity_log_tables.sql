-- Activity log and credit usage tables

-- org_activity_log
CREATE TABLE IF NOT EXISTS "public"."org_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "text" NOT NULL,
    "site" "text" NOT NULL,
    "type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."org_activity_log" OWNER TO "postgres";

DO $$ BEGIN
    ALTER TABLE ONLY "public"."org_activity_log"
        ADD CONSTRAINT "org_activity_log_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_org_activity_log_org_created" ON "public"."org_activity_log" USING "btree" ("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_org_activity_log_org_type" ON "public"."org_activity_log" USING "btree" ("org_id", "type");
CREATE INDEX IF NOT EXISTS "idx_org_activity_log_org_site" ON "public"."org_activity_log" USING "btree" ("org_id", "site");
CREATE INDEX IF NOT EXISTS "idx_org_activity_log_site_created" ON "public"."org_activity_log" USING "btree" ("site", "created_at" DESC);

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."org_activity_log" TO "service_role";

-- org_fern_credit_usage
CREATE TABLE IF NOT EXISTS "public"."org_fern_credit_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "text" NOT NULL,
    "site" "text" NOT NULL,
    "credits_used" integer NOT NULL,
    "event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."org_fern_credit_usage" OWNER TO "postgres";

DO $$ BEGIN
    ALTER TABLE ONLY "public"."org_fern_credit_usage"
        ADD CONSTRAINT "org_fern_credit_usage_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_org_fern_credit_usage_org_created" ON "public"."org_fern_credit_usage" USING "btree" ("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_org_fern_credit_usage_org_site_created" ON "public"."org_fern_credit_usage" USING "btree" ("org_id", "site", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_org_fern_credit_usage_event" ON "public"."org_fern_credit_usage" USING "btree" ("event_id");

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."org_fern_credit_usage" TO "service_role";
