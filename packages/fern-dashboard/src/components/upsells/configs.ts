import { ADDON_SEAT_PRICE_DOLLARS } from "@fern-platform/billing";
import { FileText, Globe, Lock, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import type { UpsellConfig, UpsellFeature } from "./types";

export const UPSELL_CONFIGS: Record<UpsellFeature, UpsellConfig> = {
    seats: {
        title: "Grow your team with the Pro plan",
        icon: Users,
        featureIntro: "Along with up to 5 team members, you\u2019ll get\u2026",
        features: [
            { icon: Sparkles, text: "1,000 AI credits" },
            { icon: SlidersHorizontal, text: "Version and product switching" },
            { icon: Lock, text: "Password-protected docs" }
        ],
        actions: {
            free: { type: "redirect", href: "/billing?reason=seat_limit", ctaLabel: "Upgrade to Pro" },
            paid: { type: "checkout", plan: "additional_seats", ctaLabel: "Add seats" },
            enterprise: { type: "contact-sales", href: "https://buildwithfern.com/contact" }
        },
        tierOverrides: {
            paid: {
                title: `Add additional members to your plan for $${ADDON_SEAT_PRICE_DOLLARS}/seat`,
                featureIntro: undefined,
                features: [],
                learnMoreUrl: "https://buildwithfern.com/learn/docs/getting-started/overview"
            }
        }
    },
    ai_credits: {
        title: "Upgrade to the Pro plan to receive 1,000 monthly AI credits",
        description:
            "Use the AI credits for Ask Fern AI assistant, Fern AI Writer, AI Localization, and AI response examples.",
        icon: Sparkles,
        featureIntro: "Along with more AI credits, you\u2019ll get\u2026",
        features: [
            { icon: Users, text: "5 team members (+$25 per additional member)" },
            { icon: SlidersHorizontal, text: "Version and product switching" },
            { icon: Lock, text: "Password-protected docs" }
        ],
        learnMoreUrl: "https://buildwithfern.com/learn/docs/ai-features/overview",
        actions: {
            free: { type: "redirect", href: "/billing?reason=ai_credits", ctaLabel: "Upgrade to Pro" },
            paid: { type: "checkout", plan: "additional_ai_credits", ctaLabel: "Upgrade to Pro" },
            enterprise: { type: "contact-sales", href: "https://buildwithfern.com/contact" }
        },
        tierOverrides: {
            paid: {
                title: "Add additional AI credits to your plan",
                description: "Your plan includes 1,000 monthly credits.",
                featureIntro: undefined,
                features: [],
                learnMoreUrl: "https://buildwithfern.com/learn/docs/ai-features/overview"
            }
        }
    },
    custom_domain_subpath: {
        title: "Upgrade to the Pro plan to add a subpath",
        description: 'Support for "yourcompany.com/subpath"',
        icon: Globe,
        featureIntro: "Along with a subpath, you\u2019ll get\u2026",
        features: [
            { icon: Users, text: "5 team members (+$25 per additional member)" },
            { icon: Sparkles, text: "1,000 AI credits (pay for more)" },
            { icon: SlidersHorizontal, text: "Version and product switching" }
        ],
        learnMoreUrl: "https://buildwithfern.com/learn/docs/preview-publish/setting-up-your-domain",
        actions: {
            free: { type: "redirect", href: "/billing?reason=custom_domain", ctaLabel: "Upgrade to Pro" },
            paid: { type: "contact-sales", href: "https://buildwithfern.com/contact" },
            enterprise: { type: "contact-sales", href: "https://buildwithfern.com/contact" }
        }
    },
    docs_sites: {
        title: "Docs site limit reached",
        description: "Your current plan has reached its docs site limit. Upgrade to create additional docs sites.",
        icon: FileText,
        featureIntro: "Upgrade to Pro to get\u2026",
        features: [
            { icon: Users, text: "5 team members (+$25 per additional member)" },
            { icon: Sparkles, text: "1,000 AI credits" },
            { icon: SlidersHorizontal, text: "Version and product switching" }
        ],
        actions: {
            free: { type: "redirect", href: "/billing?reason=docs_site_limit", ctaLabel: "Upgrade to Pro" },
            paid: { type: "contact-sales", href: "https://buildwithfern.com/contact" },
            enterprise: { type: "contact-sales", href: "https://buildwithfern.com/contact" }
        }
    }
};
