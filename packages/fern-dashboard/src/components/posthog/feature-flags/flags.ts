export const PosthogFeatureFlag = {
    ENABLE_DOCS_PAGE: "dashboard-enable-docs-page",
    ENABLE_SDKS_PAGE: "dashboard-enable-sdks-page",
    ENABLE_API_KEYS_PAGE: "dashboard-enable-api-keys-page",
    ENABLE_BILLING_PAGE: "dashboard-enable-billing-page",
    ENABLE_BILLING_PAGE_NEW: "dashboard-enable-billing-page-new",
    ENABLE_DOCS_ANALYTICS_TAB: "dashboard-enable-docs-analytics-tab",
    ENABLE_DOCS_ASK_FERN_TAB: "dashboard-enable-docs-ask-fern-tab",
    ENABLE_DOCS_ASK_FERN_BILLING: "dashboard-enable-docs-ask-fern-billing",
    ENABLE_VE_BRANCH_PRS: "dashboard-enable-ve-branch-prs",
    ENABLE_WEB_ANALYTICS_TAB: "dashboard-enable-web-analytics-tab",
    ENABLE_INCIDENTS_PAGE: "dashboard-enable-incidents-page",
    ENABLE_CREATE_DOCS_NEW_SITE: "dashboard-create-new-docs-site",
    ENABLE_FERN_EDITOR_PREVIEW: "dashboard-access-editor-without-repo",
    ENABLE_FINE_GRAINED_PERMISSIONS: "dashboard-enable-fine-grained-permissions",
    ENFORCE_PERMISSIONS: "dashboard-enforce-permissions",
    ENABLE_ENTITLEMENTS: "dashboard-enable-entitlements"
} as const;

export type PosthogFeatureFlag = (typeof PosthogFeatureFlag)[keyof typeof PosthogFeatureFlag];

export type PosthogFeatureFlags = Record<PosthogFeatureFlag, boolean>;
