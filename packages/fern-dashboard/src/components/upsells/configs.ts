import { FileText, Globe, Lock, SlidersHorizontal, Sparkles, Users } from "lucide-react";

import { DocsSiteHeaderIllustration } from "./DocsSiteHeaderIllustration";
import type { UpsellConfig, UpsellFeature } from "./types";

export const UPSELL_CONFIGS: Record<UpsellFeature, UpsellConfig> = {
    seats: {
        title: "Grow your team",
        description: "You are at your 2 seat limit. Upgrade to a Team plan for 5 team members and also get...",
        icon: Users,
        features: [
            { icon: Sparkles, text: "1,000 AI credits" },
            { icon: SlidersHorizontal, text: "Version and product switching" },
            { icon: Lock, text: "Password-protected docs" }
        ],
        actions: {
            free: {
                type: "redirect",
                href: "/billing?reason=seat_limit",
                ctaLabel: "Upgrade to Team"
            },
            paid: {
                type: "checkout",
                plan: "additional_seats",
                ctaLabel: "Add seats"
            },
            enterprise: {
                type: "contact-sales",
                href: "https://buildwithfern.com/contact"
            }
        },
        tierOverrides: {
            paid: {
                title: "Manage amount of members",
                featureIntro: undefined,
                features: [],
                learnMoreUrl: "https://buildwithfern.com/learn/docs/getting-started/overview"
            }
        }
    },
    ai_credits: {
        title: "Upgrade to the Team plan to receive 1,000 monthly AI credits",
        description:
            "Use the AI credits for Ask Fern AI assistant, Fern AI Writer, AI Localization, and AI response examples.",
        icon: Sparkles,
        featureIntro: "Along with more AI credits, you\u2019ll get\u2026",
        features: [
            { icon: Users, text: "5 team members" },
            { icon: SlidersHorizontal, text: "Version and product switching" },
            { icon: Lock, text: "Password-protected docs" }
        ],
        learnMoreUrl: "https://buildwithfern.com/learn/docs/ai-features/overview",
        actions: {
            free: {
                type: "redirect",
                href: "/billing?reason=ai_credits",
                ctaLabel: "Upgrade to Team"
            },
            paid: {
                type: "checkout",
                plan: "additional_ai_credits",
                ctaLabel: "Upgrade to Team"
            },
            enterprise: {
                type: "contact-sales",
                href: "https://buildwithfern.com/contact"
            }
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
        title: "Upgrade to the Team plan to add a subpath",
        description: 'Support for "yourcompany.com/subpath"',
        icon: Globe,
        featureIntro: "Along with a subpath, you\u2019ll get\u2026",
        features: [
            { icon: Users, text: "5 team members" },
            { icon: Sparkles, text: "1,000 AI credits" },
            { icon: SlidersHorizontal, text: "Version and product switching" }
        ],
        learnMoreUrl: "https://buildwithfern.com/learn/docs/preview-publish/setting-up-your-domain",
        actions: {
            free: {
                type: "redirect",
                href: "/billing?reason=custom_domain",
                ctaLabel: "Upgrade to Team"
            },
            paid: {
                type: "contact-sales",
                href: "https://buildwithfern.com/contact"
            },
            enterprise: {
                type: "contact-sales",
                href: "https://buildwithfern.com/contact"
            }
        }
    },
    docs_sites: {
        title: "Add another docs site",
        description:
            "You are at your limit of 5 docs sites. Contact us to upgrade to an Enterprise plan for more docs sites.",
        icon: FileText,
        headerContent: DocsSiteHeaderIllustration,
        actions: {
            free: {
                type: "pylon",
                ctaLabel: "Contact us",
                message:
                    "Hey Fern- I'm interested in adding more than 5 sites. Looks like I'm at the limit. Can we chat about upgrading our plan?"
            },
            paid: {
                type: "pylon",
                ctaLabel: "Contact us",
                message:
                    "Hey Fern- I'm interested in adding more than 5 sites. Looks like I'm at the limit. Can we chat about upgrading our plan?"
            },
            enterprise: {
                type: "pylon",
                ctaLabel: "Contact us",
                message:
                    "Hey Fern- I'm interested in adding more than 5 sites. Looks like I'm at the limit. Can we chat about upgrading our plan?"
            }
        }
    },
    custom_domains: {
        title: "Custom domain limit reached",
        description: "Your current plan has reached its custom domain limit. Upgrade to add more custom domains.",
        icon: Globe,
        featureIntro: "Upgrade to Team to get\u2026",
        features: [
            { icon: Users, text: "5 team members" },
            { icon: Sparkles, text: "1,000 AI credits" },
            { icon: SlidersHorizontal, text: "Version and product switching" }
        ],
        learnMoreUrl: "https://buildwithfern.com/learn/docs/preview-publish/setting-up-your-domain",
        actions: {
            free: {
                type: "redirect",
                href: "/billing?reason=custom_domain_limit",
                ctaLabel: "Upgrade to Team"
            },
            paid: {
                type: "contact-sales",
                href: "https://buildwithfern.com/contact"
            },
            enterprise: {
                type: "contact-sales",
                href: "https://buildwithfern.com/contact"
            }
        }
    }
};
