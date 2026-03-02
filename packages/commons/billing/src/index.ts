// =============================================================================
// @fern-platform/billing
// Billing package for Fern Platform
// =============================================================================

// Re-export Stripe types that consumers need
export type { Stripe } from "stripe";
// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
export { ADDON_SEAT_PRICE_DOLLARS, MAX_ADDON_SEATS, MAX_PRO_TOTAL_SEATS } from "./constants";
// -----------------------------------------------------------------------------
// Database Operations - Accounts
// -----------------------------------------------------------------------------
export {
    getOrgBillingAccount,
    getOrgBillingAccountByCustomerId,
    upsertOrgBillingAccount
} from "./db/accounts";
// -----------------------------------------------------------------------------
// Database Operations - Events (Webhook Inbox)
// -----------------------------------------------------------------------------
export {
    getEvent,
    getUnprocessedEvents,
    markEventFailed,
    markEventProcessed,
    tryInsertEvent
} from "./db/events";
// -----------------------------------------------------------------------------
// Database Operations - Products
// -----------------------------------------------------------------------------
export {
    getActiveProducts,
    getOrgActiveProducts,
    getProductById,
    getProductBySku
} from "./db/products";
// -----------------------------------------------------------------------------
// Database Operations - Subscriptions
// -----------------------------------------------------------------------------
export {
    createSubscription,
    deleteSubscriptionItemsNotIn,
    getActiveSubscription,
    getSubscriptionByStripeId,
    getSubscriptionItems,
    hasAnySubscription,
    updateSubscription,
    upsertSubscriptionByStripeId,
    upsertSubscriptionItem
} from "./db/subscriptions";
// -----------------------------------------------------------------------------
// Database Types
// -----------------------------------------------------------------------------
export type {
    BillingProduct,
    BillingProductInsert,
    OrgActiveProduct,
    OrgBillingAccount,
    OrgBillingAccountInsert,
    OrgSubscription,
    OrgSubscriptionInsert,
    OrgSubscriptionItem,
    OrgSubscriptionItemInsert,
    OrgSubscriptionUpdate,
    ProductKind,
    ProductTier,
    StripeEventInbox,
    StripeEventInboxInsert,
    SubscriptionStatus
} from "./db/types";
export { ACTIVE_STATUSES, isActiveStatus } from "./db/types";
// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------
export {
    BILLING_ERROR_CODES,
    type BillingError,
    type BillingErrorCode,
    billingError,
    isBillingError
} from "./errors";
// -----------------------------------------------------------------------------
// Plans
// -----------------------------------------------------------------------------
export {
    type BillingCycle,
    type CyclePricing,
    getPlanIndex,
    PLAN_CONFIGS,
    type PlanConfig,
    type PlanPricing
} from "./plans";
// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------
export { type BillingPlan, getBillingPlan } from "./queries/billing-plan";
// -----------------------------------------------------------------------------
// Static SKUs
// -----------------------------------------------------------------------------
export {
    ADDITIONAL_SEATS_SKU,
    LEGACY_PLAN_SKU,
    PRO_PLAN_CURRENT_SKU
} from "./static_skus";
// -----------------------------------------------------------------------------
// Price IDs
// -----------------------------------------------------------------------------
export {
    getAddonSeatsPriceId,
    getAllAddonSeatsPriceIds,
    getCheckoutPriceIds,
    getPriceIds,
    isTrialEnabled,
    type PriceIds
} from "./stripe_pricing_config";
// -----------------------------------------------------------------------------
// Subscription Helpers
// -----------------------------------------------------------------------------
export { resolveSubscriptionAddonContext, type SubscriptionAddonContext } from "./subscription_addon_context";
export type StaticSkuModule = typeof import("./static_skus");

export type StaticSku = StaticSkuModule[keyof StaticSkuModule];
// -----------------------------------------------------------------------------
// Stripe Client
// -----------------------------------------------------------------------------
export {
    constructWebhookEvent,
    getStripeClient,
    getStripeClientResult,
    resetStripeClient
} from "./stripe/client";
export {
    handleWebhookEvent,
    type WebhookHandlerResult
} from "./webhooks/handlers";
// -----------------------------------------------------------------------------
// Webhooks
// -----------------------------------------------------------------------------
export { type IdempotencyResult, withIdempotency } from "./webhooks/idempotency";
export {
    type ProcessEventResult,
    processWebhookEvent
} from "./webhooks/processor";
export {
    type CustomerUpdateResult,
    type SyncResult,
    syncCustomerFromStripe,
    syncCustomerUpdateFromStripe,
    syncSubscriptionFromStripe
} from "./webhooks/sync";
