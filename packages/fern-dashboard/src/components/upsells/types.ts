import type { ProductTier } from "@fern-platform/billing";
import type { EntitlementKey } from "@fern-platform/entitlements";
import type { ComponentType } from "react";

// ---------------------------------------------------------------------------
// Features that can trigger an upsell gate
// ---------------------------------------------------------------------------

export type UpsellFeature =
    | "seats"
    | "ai_credits"
    | "custom_domain_subpath"
    | "docs_sites"
    | "custom_domains"
    | "pdf_export"
    | "password_protection";

/**
 * Maps each upsell feature to the entitlement key that gates it.
 */
export const UPSELL_FEATURE_ENTITLEMENT_MAP: Record<UpsellFeature, EntitlementKey> = {
    seats: "seats",
    ai_credits: "ai_credits",
    custom_domain_subpath: "custom_domain_subpath",
    docs_sites: "docs_sites",
    custom_domains: "number_of_custom_domains",
    pdf_export: "pdf_export",
    password_protection: "password_protection"
};

// ---------------------------------------------------------------------------
// Upsell actions — what happens when a user clicks the CTA
// ---------------------------------------------------------------------------

export type UpsellAction =
    | { type: "redirect"; href: string; ctaLabel?: string }
    | { type: "checkout"; plan: string; ctaLabel?: string }
    | { type: "contact-sales"; href: string; ctaLabel?: string }
    | { type: "pylon"; ctaLabel?: string; message?: string };

/**
 * Default CTA button labels for each action type.
 */
export const DEFAULT_CTA_LABELS: Record<UpsellAction["type"], string> = {
    redirect: "Upgrade to Team",
    checkout: "Continue to checkout",
    "contact-sales": "Contact sales",
    pylon: "Contact us"
};

// ---------------------------------------------------------------------------
// Upsell content — optional per-tier modal body component
// ---------------------------------------------------------------------------

export interface UpsellContentProps {
    orgId: string;
    onClose: () => void;
    onAction: () => void;
}

// ---------------------------------------------------------------------------
// Upsell feature items — icon + text rows shown in the modal body
// ---------------------------------------------------------------------------

export interface UpsellFeatureItem {
    icon: ComponentType<{ className?: string }>;
    text: string;
}

// ---------------------------------------------------------------------------
// Per-tier overrides for modal copy
// ---------------------------------------------------------------------------

export interface UpsellTierOverride {
    title?: string;
    description?: string;
    featureIntro?: string;
    features?: UpsellFeatureItem[];
    learnMoreUrl?: string;
}

// ---------------------------------------------------------------------------
// Upsell config — full configuration for a single feature gate
// ---------------------------------------------------------------------------

export interface UpsellConfig {
    title: string;
    description?: string;
    icon: ComponentType<{ className?: string }>;
    /** Optional component that replaces the default icon+gradient header. */
    headerContent?: ComponentType;
    /** Intro text shown above the feature list (e.g. "Along with ..., you'll get...") */
    featureIntro?: string;
    /** Feature items shown in the modal body (icon + text rows) */
    features?: UpsellFeatureItem[];
    /** URL for the "Learn more" button. When absent, the button is hidden. */
    learnMoreUrl?: string;
    actions: Partial<Record<ProductTier, UpsellAction>>;
    content?: Partial<Record<ProductTier, ComponentType<UpsellContentProps>>>;
    /** Per-tier overrides for title, description, features, etc. */
    tierOverrides?: Partial<Record<ProductTier, UpsellTierOverride>>;
}
