import type { PostHog } from "posthog-js";
import type { PostHog as PostHogNode } from "posthog-node";
import type { CustomDomainConfiguredProperties } from "./events/CustomDomainConfiguredEvent";
import type { DocsSitePublishedProperties } from "./events/DocsSitePublishedEvent";
import type { EditorSessionStartedProperties } from "./events/EditorSessionStartedEvent";
import type { PostmanSpecPublishedProperties } from "./events/PostmanSpecPublishedEvent";
import type { SubscriptionActivatedProperties } from "./events/SubscriptionActivatedEvent";
import type { TrialStartedProperties } from "./events/TrialStartedEvent";
import type { UserJoinedOrgProperties } from "./events/UserJoinedOrgEvent";

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
    ONBOARDING_DOCS_API_SPEC_ADDED: "dashboard-onboarding-docs-api-spec-added",
    ONBOARDING_DOCS_API_SPEC_REMOVED: "dashboard-onboarding-docs-api-spec-removed",
    ONBOARDING_DOCS_DETAILS_STEP_VIEWED: "dashboard-onboarding-docs-details-step-viewed",
    ONBOARDING_DOCS_DETAILS_STEP_SUBMITTED: "dashboard-onboarding-docs-details-step-submitted",
    ONBOARDING_DOCS_SITE_CREATED: "dashboard-onboarding-docs-site-created",
    ONBOARDING_DOCS_COMPLETE_ACTION: "dashboard-onboarding-docs-complete-action",
    ONBOARDING_SDK_PAGE_VIEWED: "dashboard-onboarding-sdk-page-viewed",
    ONBOARDING_SDK_QUICKSTART_CLICKED: "dashboard-onboarding-sdk-quickstart-clicked",

    // PDF export events
    PDF_EXPORT_CLICKED: "dashboard-pdf-export-clicked",

    // Postman hotlink events
    POSTMAN_VIEW_DOCS_ENTERED: "dashboard-postman-view-docs-entered",

    // Billing & entitlement events
    BILLING_LIMIT_HIT: "dashboard-billing-limit-hit",
    UPGRADE_CTA_CLICKED: "dashboard-upgrade-cta-clicked",
    CHECKOUT_STARTED: "dashboard-checkout-started",
    CHECKOUT_COMPLETED: "dashboard-checkout-completed",
    CHECKOUT_CANCELED: "dashboard-checkout-canceled",
    ADDON_SEATS_UPDATED: "dashboard-addon-seats-updated",

    // Custom domain onboarding events
    CUSTOM_DOMAIN_INITIATED: "dashboard-custom-domain-initiated",
    CUSTOM_DOMAIN_INITIATION_FAILED: "dashboard-custom-domain-initiation-failed",
    CUSTOM_DOMAIN_OWNERSHIP_VERIFIED: "dashboard-custom-domain-ownership-verified",
    CUSTOM_DOMAIN_OWNERSHIP_VERIFICATION_FAILED: "dashboard-custom-domain-ownership-verification-failed",
    CUSTOM_DOMAIN_PR_CREATED: "dashboard-custom-domain-pr-created",
    CUSTOM_DOMAIN_PR_CREATION_FAILED: "dashboard-custom-domain-pr-creation-failed",
    CUSTOM_DOMAIN_DNS_VERIFIED: "dashboard-custom-domain-dns-verified",
    CUSTOM_DOMAIN_DNS_VERIFICATION_FAILED: "dashboard-custom-domain-dns-verification-failed",
    CUSTOM_DOMAIN_PROXY_CONFIRMED: "dashboard-custom-domain-proxy-confirmed",
    CUSTOM_DOMAIN_PROXY_CONFIRMATION_FAILED: "dashboard-custom-domain-proxy-confirmation-failed",
    CUSTOM_DOMAIN_SITE_LIVE: "dashboard-custom-domain-site-live",
    CUSTOM_DOMAIN_SITE_LIVENESS_TIMEOUT: "dashboard-custom-domain-site-liveness-timeout",

    // Funnel tracking events (server-side)
    POSTMAN_SPEC_PUBLISHED: "postman-spec-published",
    USER_JOINED_ORG: "user-joined-org",
    DOCS_SITE_PUBLISHED: "docs-site-published",
    EDITOR_SESSION_STARTED: "editor-session-started",
    CUSTOM_DOMAIN_CONFIGURED: "custom-domain-configured",
    TRIAL_STARTED: "trial-started",
    SUBSCRIPTION_ACTIVATED: "subscription-activated"
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
    [PosthogEventName.ONBOARDING_DOCS_API_SPEC_ADDED]: {
        source: "custom" | "sample";
        fileName: string;
    };
    [PosthogEventName.ONBOARDING_DOCS_API_SPEC_REMOVED]: {
        source: "custom" | "sample";
        fileName: string;
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
        postmanCollectionId?: string | null;
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

    // Postman hotlink event payloads
    [PosthogEventName.POSTMAN_VIEW_DOCS_ENTERED]: {
        docsUrl: string;
        hasToken: boolean;
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

    // Custom domain onboarding event payloads
    [PosthogEventName.CUSTOM_DOMAIN_INITIATED]: {
        domain: string;
        isSubpath: boolean;
    };
    [PosthogEventName.CUSTOM_DOMAIN_INITIATION_FAILED]: {
        domain: string;
        error: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_OWNERSHIP_VERIFIED]: {
        domain: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_OWNERSHIP_VERIFICATION_FAILED]: {
        domain: string;
        error: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_PR_CREATED]: {
        domain: string;
        provider: string;
        prUrl: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_PR_CREATION_FAILED]: {
        domain: string;
        provider: string;
        error: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_DNS_VERIFIED]: {
        domain: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_DNS_VERIFICATION_FAILED]: {
        domain: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_PROXY_CONFIRMED]: {
        domain: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_PROXY_CONFIRMATION_FAILED]: {
        domain: string;
        error: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_SITE_LIVE]: {
        domain: string;
    };
    [PosthogEventName.CUSTOM_DOMAIN_SITE_LIVENESS_TIMEOUT]: {
        domain: string;
    };

    // Funnel tracking event payloads (server-side) — all extend BaseServerPosthogEventProperties
    [PosthogEventName.POSTMAN_SPEC_PUBLISHED]: PostmanSpecPublishedProperties;
    [PosthogEventName.USER_JOINED_ORG]: UserJoinedOrgProperties;
    [PosthogEventName.DOCS_SITE_PUBLISHED]: DocsSitePublishedProperties;
    [PosthogEventName.EDITOR_SESSION_STARTED]: EditorSessionStartedProperties;
    [PosthogEventName.CUSTOM_DOMAIN_CONFIGURED]: CustomDomainConfiguredProperties;
    [PosthogEventName.TRIAL_STARTED]: TrialStartedProperties;
    [PosthogEventName.SUBSCRIPTION_ACTIVATED]: SubscriptionActivatedProperties;
};

// Server-side funnel event property types are now defined in individual
// files under ./events/ and re-exported here for backwards compatibility.
export type {
    CustomDomainConfiguredProperties,
    DocsSitePublishedProperties,
    EditorSessionStartedProperties,
    PostmanSpecPublishedProperties,
    SubscriptionActivatedProperties,
    TrialStartedProperties,
    UserJoinedOrgProperties
};
export type { BaseServerPosthogEventProperties } from "./events/types";

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

/**
 * Server-side type-safe event capture helper using posthog-node.
 * Used for capturing funnel tracking events from API routes and server actions.
 */
export function captureServerEvent<Name extends keyof PosthogEventPayloads>(
    posthog: PostHogNode,
    distinctId: string,
    name: Name,
    properties: PosthogEventPayloads[Name]
): void {
    posthog.capture({ distinctId, event: name, properties });
}
