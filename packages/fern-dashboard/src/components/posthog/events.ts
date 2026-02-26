import type { PostHog } from "posthog-js";

/**
 * Centralized PostHog event names for type safety and consistency.
 * Similar to feature flags pattern, this ensures we don't use magic strings.
 */
export const PosthogEventName = {
    DOCS_TAB_VIEWED: "dashboard-docs-tab-viewed",
    REPO_CONNECTED: "dashboard-repo-connected",
    DOCS_ZERO_STATE_VIEWED: "dashboard-docs-zero-state-viewed",
    DOCS_REQUEST_ACCESS_CLICKED: "dashboard-docs-request-access-clicked",
    DOCS_REQUEST_ACCESS_SUCCESS: "dashboard-docs-request-access-success",
    DOCS_PAGE_VIEWED: "dashboard-docs-page-viewed",
    SDK_DEMO_SCHEDULED: "dashboard-sdk-demo-scheduled",

    // Onboarding flow events
    CREATE_ORGANIZATION_STEP_VIEWED: "dashboard-create-organization-step-viewed",
    ORGANIZATION_CREATED: "dashboard-organization-created",
    ONBOARDING_PRODUCT_SELECTED: "dashboard-onboarding-product-selected",
    ONBOARDING_DOCS_API_SPEC_STEP_VIEWED: "dashboard-onboarding-docs-api-spec-step-viewed",
    ONBOARDING_DOCS_API_SPEC_STEP_COMPLETED: "dashboard-onboarding-docs-api-spec-step-completed",
    ONBOARDING_DOCS_DETAILS_STEP_VIEWED: "dashboard-onboarding-docs-details-step-viewed",
    ONBOARDING_DOCS_DETAILS_STEP_SUBMITTED: "dashboard-onboarding-docs-details-step-submitted",
    ONBOARDING_DOCS_SITE_CREATED: "dashboard-onboarding-docs-site-created",
    ONBOARDING_DOCS_COMPLETE_ACTION: "dashboard-onboarding-docs-complete-action",
    ONBOARDING_SDK_PAGE_VIEWED: "dashboard-onboarding-sdk-page-viewed",
    ONBOARDING_SDK_QUICKSTART_CLICKED: "dashboard-onboarding-sdk-quickstart-clicked",

    // PDF export events
    PDF_EXPORT_CLICKED: "dashboard-pdf-export-clicked",

    // Billing & entitlement events
    BILLING_LIMIT_HIT: "dashboard-billing-limit-hit",
    UPGRADE_CTA_CLICKED: "dashboard-upgrade-cta-clicked",
    CHECKOUT_STARTED: "dashboard-checkout-started",
    CHECKOUT_COMPLETED: "dashboard-checkout-completed",
    CHECKOUT_CANCELED: "dashboard-checkout-canceled",
    ADDON_SEATS_UPDATED: "dashboard-addon-seats-updated"
} as const;

export type PosthogEventName = (typeof PosthogEventName)[keyof typeof PosthogEventName];

/**
 * Type map for event payloads. Each event name maps to its required properties.
 * This ensures type safety when capturing events.
 */
export type PosthogEventPayloads = {
    [PosthogEventName.DOCS_TAB_VIEWED]: {
        tab: string;
        siteHasGitHubAppInstalled: boolean;
        siteHasConnectedRepo: boolean;
    };
    [PosthogEventName.REPO_CONNECTED]: {
        siteHasGitHubAppInstalled: boolean;
        siteHasConnectedRepo: boolean;
    };
    [PosthogEventName.DOCS_ZERO_STATE_VIEWED]: {
        hasOrgName: boolean;
        userEmail: string;
    };
    [PosthogEventName.DOCS_REQUEST_ACCESS_CLICKED]: {
        userEmail: string;
        docsUrl: string;
    };
    [PosthogEventName.DOCS_REQUEST_ACCESS_SUCCESS]: {
        userEmail: string;
        docsUrl: string;
        autoApproved: boolean;
    };
    [PosthogEventName.DOCS_PAGE_VIEWED]: {
        orgName: string;
        docsUrl: string;
        userEmail: string;
    };
    [PosthogEventName.SDK_DEMO_SCHEDULED]: {
        userEmail: string;
        userName: string;
    };

    // Onboarding flow event payloads
    [PosthogEventName.CREATE_ORGANIZATION_STEP_VIEWED]: {
        prepopulatedOrgName?: string;
    };
    [PosthogEventName.ORGANIZATION_CREATED]: {
        organizationId: string;
        organizationName: string;
        prepopulatedOrgName?: string;
    };
    [PosthogEventName.ONBOARDING_PRODUCT_SELECTED]: {
        product: "docs" | "sdk";
    };
    [PosthogEventName.ONBOARDING_DOCS_API_SPEC_STEP_VIEWED]: Record<string, never>;
    [PosthogEventName.ONBOARDING_DOCS_API_SPEC_STEP_COMPLETED]: {
        action: "continue" | "skip";
        specCount: number;
    };
    [PosthogEventName.ONBOARDING_DOCS_DETAILS_STEP_VIEWED]: Record<string, never>;
    [PosthogEventName.ONBOARDING_DOCS_DETAILS_STEP_SUBMITTED]: {
        docsSiteUrl: string;
        hasLogoUrl: boolean;
        hasPrimaryColor: boolean;
    };
    [PosthogEventName.ONBOARDING_DOCS_SITE_CREATED]: {
        docsSiteUrl: string;
        sitePublishUrl: string;
    };
    [PosthogEventName.ONBOARDING_DOCS_COMPLETE_ACTION]: {
        action: "view_site" | "continue_to_setup";
        docsSiteUrl: string;
    };
    [PosthogEventName.ONBOARDING_SDK_PAGE_VIEWED]: Record<string, never>;
    [PosthogEventName.ONBOARDING_SDK_QUICKSTART_CLICKED]: Record<string, never>;

    // PDF export event payloads
    [PosthogEventName.PDF_EXPORT_CLICKED]: {
        orgName: string;
        docsUrl: string;
    };

    // Billing & entitlement event payloads
    [PosthogEventName.BILLING_LIMIT_HIT]: {
        limitType: "ai_credits" | "docs_sites" | "seats" | "custom_domain_subpath";
    };
    [PosthogEventName.UPGRADE_CTA_CLICKED]: {
        source: "docs_limit_dialog" | "seat_upsell" | "custom_domain_modal" | "billing_page" | "upsell_modal";
        targetPlan?: string;
    };
    [PosthogEventName.CHECKOUT_STARTED]: {
        targetPlan: string;
        billingCycle: "monthly" | "yearly";
        isUpgrade: boolean;
    };
    [PosthogEventName.CHECKOUT_COMPLETED]: {
        plan: string;
    };
    [PosthogEventName.CHECKOUT_CANCELED]: Record<string, never>;
    [PosthogEventName.ADDON_SEATS_UPDATED]: {
        previousQuantity: number;
        newQuantity: number;
        delta: number;
    };
};

/**
 * Type-safe event capture helper.
 * Ensures the event name and payload match the defined types.
 *
 * @param posthog - PostHog instance (can be null if tracking is disabled)
 * @param name - Event name from PosthogEventName
 * @param properties - Event properties matching the event's payload type
 */
export function captureEvent<Name extends keyof PosthogEventPayloads>(
    posthog: PostHog | null,
    name: Name,
    properties: PosthogEventPayloads[Name]
): void {
    posthog?.capture(name, properties);
}

/**
 * Convenience helper for capturing docs tab viewed events.
 * Provides a more discoverable API for this specific event.
 *
 * @param posthog - PostHog instance (can be null if tracking is disabled)
 * @param properties - Tab view event properties
 */
export function captureDocsTabViewed(
    posthog: PostHog | null,
    properties: PosthogEventPayloads[typeof PosthogEventName.DOCS_TAB_VIEWED]
): void {
    captureEvent(posthog, PosthogEventName.DOCS_TAB_VIEWED, properties);
}

/**
 * Convenience helper for capturing repo connected events.
 * Provides a more discoverable API for this specific event.
 *
 * @param posthog - PostHog instance (can be null if tracking is disabled)
 * @param properties - Repo connected event properties
 */
export function captureRepoConnected(
    posthog: PostHog | null,
    properties: PosthogEventPayloads[typeof PosthogEventName.REPO_CONNECTED]
): void {
    captureEvent(posthog, PosthogEventName.REPO_CONNECTED, properties);
}
