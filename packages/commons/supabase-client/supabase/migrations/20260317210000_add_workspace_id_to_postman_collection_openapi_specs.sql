-- Add workspace_id column to postman_collection_openapi_specs

ALTER TABLE "public"."postman_collection_openapi_specs"
    ADD COLUMN IF NOT EXISTS "workspace_id" "text";
