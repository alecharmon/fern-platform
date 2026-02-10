import type { ProductTier } from "@fern-platform/billing";
import type { LucideIcon } from "lucide-react";
import {
    ChartNoAxesCombined,
    Code,
    FileDown,
    Fingerprint,
    Globe,
    Layers,
    Lock,
    LockOpen,
    MessageSquare,
    Paintbrush,
    Server,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    SquareM,
    SquarePen,
    Users
} from "lucide-react";

export interface PlanFeature {
    icon: LucideIcon;
    text: string;
}

export type BillingCycle = "monthly" | "yearly";

export interface CyclePricing {
    displayPrice: string;
    period: string;
    /** Stripe price IDs for this billing cycle */
    priceIds: string[];
}

export interface Plan {
    name: string;
    /** The billing package tier this plan maps to */
    tier: ProductTier;
    /** Default display price (used when no cyclePricing or for static plans) */
    price: string;
    period: string;
    description: string;
    buttonText: string;
    buttonStyle: "primary" | "outline";
    /** Cycle-specific pricing with Stripe price IDs. null = no checkout (free/enterprise). */
    cyclePricing: Record<BillingCycle, CyclePricing> | null;
    /** Super-user-only: free pricing override with a $0 Stripe price ID */
    superUserPriceIds?: string[];
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
        price: "$0",
        period: "",
        description: "For individuals getting started.",
        buttonText: "Get started",
        buttonStyle: "outline",
        cyclePricing: null,
        features: [
            { icon: SquareM, text: "Markdown Guides and API reference" },
            { icon: Code, text: "Interactive API explorer" },
            { icon: SquarePen, text: "Web editor" },
            { icon: Globe, text: "Custom domain" },
            { icon: ChartNoAxesCombined, text: "Built-in analytics" },
            { icon: Sparkles, text: "AI-powered search" }
        ],
        planSkuMatcher: (sku) => sku === undefined
    },
    {
        name: "Professional",
        tier: "paid",
        price: "$200",
        period: "/mo",
        description: "For small teams.",
        buttonText: "Upgrade",
        buttonStyle: "primary",
        cyclePricing: {
            monthly: {
                displayPrice: "$200",
                period: "/mo",
                priceIds: ["price_1SxVS3FYKJHzTJV9tzJ6f5c0"]
            },
            yearly: {
                displayPrice: "$150",
                period: "/mo",
                priceIds: ["price_1SxVS3FYKJHzTJV9j6eSH7GZ"]
            }
        },
        superUserPriceIds: ["price_1SxYXdFYKJHzTJV9khP7EqTH"],
        featureHeader: "Everything in Hobby, plus:",
        features: [
            { icon: Layers, text: "Multiple API specs" },
            { icon: Users, text: "Team collaboration" },
            { icon: Lock, text: "Password-protected docs" },
            { icon: SlidersHorizontal, text: "Version and product switching" },
            { icon: FileDown, text: "PDF exports" }
        ],
        planSkuMatcher: (sku) => sku === "2025-02-05:docs-team"
    },
    {
        name: "Custom",
        tier: "enterprise",
        price: "Custom",
        period: "",
        description: "For scaling teams.",
        buttonText: "Contact sales",
        buttonStyle: "outline",
        cyclePricing: null,
        featureHeader: "Everything in Professional, plus:",
        features: [
            { icon: Fingerprint, text: "Visitor authentication (JWT, SSO)" },
            { icon: LockOpen, text: "Role-based access control (RBAC)" },
            { icon: Server, text: "Self-hosting" },
            { icon: Paintbrush, text: "Enterprise SSO" },
            { icon: MessageSquare, text: "Dedicated Slack / Teams channel" },
            { icon: ShieldCheck, text: "Security and legal review" }
        ],
        planSkuMatcher: (sku) => sku === "legacy:custom-enterprise"
    }
];

/**
 * Get the index of a plan in the ordered plans array.
 * Higher index = higher tier. Returns -1 if not found.
 */
export function getPlanIndex(planName: string): number {
    return plans.findIndex((p) => p.name.toLowerCase() === planName.toLowerCase());
}
