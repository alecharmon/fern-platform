-- Add team_name and team_domain columns to postman_app_installations

ALTER TABLE "public"."postman_app_installations"
    ADD COLUMN IF NOT EXISTS "team_name" "text",
    ADD COLUMN IF NOT EXISTS "team_domain" "text";
