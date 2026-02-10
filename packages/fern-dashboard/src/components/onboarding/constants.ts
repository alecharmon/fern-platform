/**
 * Default API specification samples used throughout the onboarding flow
 */
export const DEFAULT_SPECS = [
    {
        fileName: "example-openapi.json",
        assetUrl: "https://raw.githubusercontent.com/fern-api/docs-starter/refs/heads/main/fern/openapi.yaml"
    },
    {
        fileName: "example-asyncapi.yaml",
        assetUrl: "https://raw.githubusercontent.com/fern-api/docs-starter/refs/heads/main/fern/asyncapi.yaml"
    }
] as const;

export const CALENDLY_URL = "https://calendly.com/d/ckyd-3fj-2wk/fern-product-demo";

export const CALENDLY_URL_EMBED = `${CALENDLY_URL}?hide_event_type_details=1&hide_gdpr_banner=1`;
