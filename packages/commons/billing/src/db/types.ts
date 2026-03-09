import type { Database, Tables } from "@fern-platform/supabase";

// Table row types
export type BillingProduct = Tables<"billing_product">;
export type OrgBillingAccount = Tables<"org_billing_account">;
export type OrgSubscription = Tables<"org_subscription">;
export type OrgSubscriptionItem = Tables<"org_subscription_item">;
export type StripeEventInbox = Tables<"stripe_event_inbox">;

// Override types (not yet in generated Supabase types)
export interface OrgBillingOverride {
    id: string;
    org_id: string;
    sku: string;
    added_by: string;
    start_date: string;
    end_date: string | null;
    notes: string | null;
    created_at: string;
    revoked_at: string | null;
}

export interface OrgBillingOverrideInsert {
    org_id: string;
    sku: string;
    added_by: string;
    start_date?: string;
    end_date?: string | null;
    notes?: string | null;
}

// View types
export type OrgActiveProduct = Database["public"]["Views"]["org_active_products"]["Row"];

// Insert types (for creating records)
export type BillingProductInsert = Database["public"]["Tables"]["billing_product"]["Insert"];
export type OrgBillingAccountInsert = Database["public"]["Tables"]["org_billing_account"]["Insert"];
export type OrgSubscriptionInsert = Database["public"]["Tables"]["org_subscription"]["Insert"];
export type OrgSubscriptionItemInsert = Database["public"]["Tables"]["org_subscription_item"]["Insert"];
export type StripeEventInboxInsert = Database["public"]["Tables"]["stripe_event_inbox"]["Insert"];

// Update types (for updating records)
export type OrgSubscriptionUpdate = Database["public"]["Tables"]["org_subscription"]["Update"];

// Domain types with stricter typing
export type SubscriptionStatus =
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "unpaid";
export type ProductTier = "free" | "paid" | "enterprise";
export type ProductKind = "plan" | "addon";

/**
 * Active subscription statuses that grant access to paid features.
 */
export const ACTIVE_STATUSES: readonly SubscriptionStatus[] = ["active", "trialing", "past_due"];

/**
 * Check if a status is considered active.
 */
export function isActiveStatus(status: string): status is SubscriptionStatus {
    return ACTIVE_STATUSES.includes(status as SubscriptionStatus);
}
