import type { ProductTier } from "./db/types";
import { LEGACY_PLAN_SKU, PRO_PLAN_CURRENT_SKU } from "./static_skus";

export type BillingCycle = "monthly" | "yearly";

export interface CyclePricing {
    displayPrice: string;
    period: string;
    subtitle: string;
}

export type PlanPricing =
    | { type: "static"; displayPrice: string; period: string; subtitle: string }
    | { type: "cycle"; cycles: Record<BillingCycle, CyclePricing>; hasSuperUserPricing?: boolean };

export interface PlanConfig {
    name: string;
    tier: ProductTier;
    description: string;
    buttonText: string;
    trialButtonText?: string;
    buttonStyle: "primary" | "outline";
    pricing: PlanPricing;
    featureHeader?: string;
    features: string[];
    planSkuMatcher: (sku?: string) => boolean;
}

/**
 * Ordered list of plan configurations from lowest to highest tier.
 *
 * This is pure data — no UI dependencies. The dashboard layers on
 * icons and other React-specific concerns when rendering.
 */
export const PLAN_CONFIGS: PlanConfig[] = [
    {
        name: "Hobby",
        tier: "free",
        description: "For individuals",
        buttonText: "Get started",
        buttonStyle: "outline",
        pricing: { type: "static", displayPrice: "$0", period: "/mo", subtitle: "free forever" },
        features: [
            "2 team members",
            "250 AI credits",
            "Custom domain (docs.example.com)",
            "Guides, API references, and changelogs",
            "API explorer",
            "Web editor"
        ],
        planSkuMatcher: (sku) => sku === undefined
    },
    {
        name: "Pro",
        tier: "paid",
        description: "For small teams",
        buttonText: "Upgrade",
        trialButtonText: "Start 14-day trial",
        buttonStyle: "primary",
        pricing: {
            type: "cycle",
            cycles: {
                monthly: {
                    displayPrice: "$200",
                    period: "/mo",
                    subtitle: "billed monthly"
                },
                yearly: {
                    displayPrice: "$150",
                    period: "/mo",
                    subtitle: "billed yearly"
                }
            },
            hasSuperUserPricing: true
        },
        featureHeader: "Everything in Hobby, plus:",
        features: [
            "5 team members (+$20 per additional member)",
            "1,000 AI credits",
            "Custom subpath (example.com/docs)",
            "Version and product switching",
            "Password-protected docs",
            "PDF exports"
        ],
        planSkuMatcher: (sku) => sku === PRO_PLAN_CURRENT_SKU
    },
    {
        name: "Enterprise",
        tier: "enterprise",
        description: "For scaling teams and enterprises",
        buttonText: "Contact sales",
        buttonStyle: "outline",
        pricing: { type: "static", displayPrice: "Tailored pricing", period: "", subtitle: "billed yearly" },
        featureHeader: "Everything in Pro, plus:",
        features: [
            "Visitor authentication (JWT, SSO)",
            "Role-based access control (RBAC)",
            "Translated content",
            "Self-hosting",
            "Enterprise SSO",
            "Dedicated Slack / Teams channel"
        ],
        planSkuMatcher: (sku) => sku === LEGACY_PLAN_SKU
    }
];

/**
 * Get the index of a plan in the ordered plans array.
 * Higher index = higher tier. Returns -1 if not found.
 */
export function getPlanIndex(planName: string): number {
    return PLAN_CONFIGS.findIndex((p) => p.name.toLowerCase() === planName.toLowerCase());
}
