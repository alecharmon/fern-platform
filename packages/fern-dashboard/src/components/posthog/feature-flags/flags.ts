export const PosthogFeatureFlag = {
    ENABLE_SDKS_PAGE: "dashboard-enable-sdks-page",
    ENABLE_API_KEYS_PAGE: "dashboard-enable-api-keys-page",
    ENABLE_DOCS_ASK_FERN_TAB: "dashboard-enable-docs-ask-fern-tab",
    ENABLE_DOCS_ASK_FERN_BILLING: "dashboard-enable-docs-ask-fern-billing",
    ENABLE_VE_BRANCH_PRS: "dashboard-enable-ve-branch-prs",
    ENABLE_FINE_GRAINED_PERMISSIONS: "dashboard-enable-fine-grained-permissions"
} as const;

export type PosthogFeatureFlag = (typeof PosthogFeatureFlag)[keyof typeof PosthogFeatureFlag];

export type PosthogFeatureFlags = Record<PosthogFeatureFlag, boolean>;
