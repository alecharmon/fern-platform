import type { ProductTier } from "@fern-platform/billing";
import {
    Code,
    FileDown,
    Fingerprint,
    Globe,
    GlobeLock,
    Languages,
    Lock,
    LockOpen,
    MessageSquare,
    Server,
    SlidersHorizontal,
    Sparkles,
    SquareM,
    SquarePen,
    Users
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { LEGACY_PLAN_SKU, PRO_PLAN_CURRENT_SKU } from "../../../../../commons/billing/dist/static_skus";

export type PlanFeatureIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export interface PlanFeature {
    icon: PlanFeatureIcon;
    text: string;
}

export type BillingCycle = "monthly" | "yearly";

export interface CyclePricing {
    displayPrice: string;
    period: string;
    subtitle: string;
    /** Stripe price IDs for this billing cycle */
    priceIds: string[];
}

export type PlanPricing =
    | { type: "static"; displayPrice: string; period: string; subtitle: string }
    | { type: "cycle"; cycles: Record<BillingCycle, CyclePricing>; superUserPriceIds?: string[] };

export interface Plan {
    name: string;
    /** The billing package tier this plan maps to */
    tier: ProductTier;
    description: string;
    buttonText: string;
    /** Button text shown when user is eligible for a free trial */
    trialButtonText?: string;
    buttonStyle: "primary" | "outline";
    pricing: PlanPricing;
    /** Optional header shown above features, e.g. "Everything in Hobby" */
    featureHeader?: string;
    features: PlanFeature[];
    planSkuMatcher: (sku?: string) => boolean;
}

/**
 * Ordered list of plans for the billing UI.
 * Plans are ordered from lowest to highest tier.
 */
export const plans: Plan[] = [
    {
        name: "Hobby",
        tier: "free",
        description: "For individuals",
        buttonText: "Get started",
        buttonStyle: "outline",
        pricing: { type: "static", displayPrice: "$0", period: "/mo", subtitle: "free forever" },
        features: [
            { icon: Users, text: "2 team members" },
            { icon: Sparkles, text: "250 AI credits" },
            { icon: Globe, text: "Custom domain (docs.example.com)" },
            { icon: SquareM, text: "Guides, API references, and changelogs" },
            { icon: Code, text: "API explorer" },
            { icon: SquarePen, text: "Web editor" }
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
                    subtitle: "billed monthly",
                    priceIds: ["price_1SxVS3FYKJHzTJV9tzJ6f5c0"]
                },
                yearly: {
                    displayPrice: "$150",
                    period: "/mo",
                    subtitle: "billed yearly",
                    priceIds: ["price_1SxVS3FYKJHzTJV9j6eSH7GZ"]
                }
            },
            superUserPriceIds: ["price_1SxYXdFYKJHzTJV9khP7EqTH"]
        },
        featureHeader: "Everything in Hobby, plus:",
        features: [
            { icon: Users, text: "5 team members (+$20 per additional member)" },
            { icon: Sparkles, text: "1,000 AI credits" },
            { icon: Globe, text: "Custom subpath (example.com/docs)" },
            { icon: SlidersHorizontal, text: "Version and product switching" },
            { icon: Lock, text: "Password-protected docs" },
            { icon: FileDown, text: "PDF exports" }
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
            { icon: Fingerprint, text: "Visitor authentication (JWT, SSO)" },
            { icon: LockOpen, text: "Role-based access control (RBAC)" },
            { icon: Languages, text: "Translated content" },
            { icon: Server, text: "Self-hosting" },
            { icon: GlobeLock, text: "Enterprise SSO" },
            { icon: MessageSquare, text: "Dedicated Slack / Teams channel" }
        ],
        planSkuMatcher: (sku) => sku === LEGACY_PLAN_SKU
    }
];

/**
 * Get the index of a plan in the ordered plans array.
 * Higher index = higher tier. Returns -1 if not found.
 */
export function getPlanIndex(planName: string): number {
    return plans.findIndex((p) => p.name.toLowerCase() === planName.toLowerCase());
}
