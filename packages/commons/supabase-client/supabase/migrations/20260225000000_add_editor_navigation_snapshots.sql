-- Editor navigation snapshots

CREATE TABLE IF NOT EXISTS "public"."editor_navigation_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "org_id" "text" NOT NULL,
    "branch" "text" NOT NULL,
    "docs_url" "text" NOT NULL,
    "snapshot_data" "jsonb" NOT NULL,
    "schema_version" integer NOT NULL DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."editor_navigation_snapshots" OWNER TO "postgres";

DO $$ BEGIN
    ALTER TABLE ONLY "public"."editor_navigation_snapshots"
        ADD CONSTRAINT "editor_navigation_snapshots_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY "public"."editor_navigation_snapshots"
        ADD CONSTRAINT "editor_navigation_snapshots_org_id_branch_docs_url_key" UNIQUE ("org_id", "branch", "docs_url");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "editor_navigation_snapshots_org_id_idx" ON "public"."editor_navigation_snapshots" USING "btree" ("org_id");
CREATE INDEX IF NOT EXISTS "editor_navigation_snapshots_org_id_branch_docs_url_idx" ON "public"."editor_navigation_snapshots" USING "btree" ("org_id", "branch", "docs_url");

CREATE OR REPLACE FUNCTION "public"."update_editor_snapshots_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER "set_editor_snapshots_updated_at"
        BEFORE UPDATE ON "public"."editor_navigation_snapshots"
        FOR EACH ROW
        EXECUTE FUNCTION "public"."update_editor_snapshots_updated_at"();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."editor_navigation_snapshots" TO "service_role";
