/**
 * Default API specification samples used throughout the onboarding flow
 */
export const DEFAULT_SPECS = [
    {
        fileName: "example-openapi.json",
        assetUrl: "https://petstore3.swagger.io/api/v3/openapi.json"
    },
    {
        fileName: "example-asyncapi.yaml",
        assetUrl: "https://raw.githubusercontent.com/asyncapi/spec/master/examples/streetlights-mqtt-asyncapi.yml"
    }
] as const;

export const CALENDLY_URL = "https://calendly.com/d/ckyd-3fj-2wk/fern-product-demo";

export const CALENDLY_URL_EMBED = `${CALENDLY_URL}?hide_event_type_details=1&hide_gdpr_banner=1`;
