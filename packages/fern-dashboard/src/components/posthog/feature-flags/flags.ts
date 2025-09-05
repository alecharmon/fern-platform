export const PosthogFeatureFlag = {
  ENABLE_DOCS_PAGE: "dashboard-enable-docs-page",
  ENABLE_SDKS_PAGE: "dashboard-enable-sdks-page",
  ENABLE_API_KEYS_PAGE: "dashboard-enable-api-keys-page",
  ENABLE_BILLING_PAGE: "dashboard-enable-billing-page",
  ENABLE_DOCS_ANALYTICS_TAB: "dashboard-enable-docs-analytics-tab",
  ENABLE_DOCS_ASK_FERN_TAB: "dashboard-enable-docs-ask-fern-tab",
  ENABLE_DOCS_ASK_FERN_BILLING: "dashboard-enable-docs-ask-fern-billing",
} as const;

export type PosthogFeatureFlag =
  (typeof PosthogFeatureFlag)[keyof typeof PosthogFeatureFlag];

export type PosthogFeatureFlags = Record<PosthogFeatureFlag, boolean>;
