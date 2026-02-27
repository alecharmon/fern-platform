import { PLAN_CONFIGS, type PlanConfig } from "@fern-platform/billing";
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

export type { BillingCycle, CyclePricing, PlanConfig, PlanPricing } from "@fern-platform/billing";
export { getPlanIndex } from "@fern-platform/billing";

export type PlanFeatureIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export interface PlanFeature {
    icon: PlanFeatureIcon;
    text: string;
}

export interface Plan extends Omit<PlanConfig, "features"> {
    features: PlanFeature[];
}

/**
 * Icon mapping per plan name. Each array must match the order/length
 * of the corresponding plan's feature strings in PLAN_CONFIGS.
 */
const PLAN_FEATURE_ICONS: Record<string, PlanFeatureIcon[]> = {
    Hobby: [Users, Sparkles, Globe, SquareM, Code, SquarePen],
    Pro: [Users, Sparkles, Globe, SlidersHorizontal, Lock, FileDown],
    Enterprise: [Fingerprint, LockOpen, Languages, Server, GlobeLock, MessageSquare]
};

/**
 * Plans enriched with UI icons, ordered lowest to highest tier.
 */
export const plans: Plan[] = PLAN_CONFIGS.map((config) => {
    const icons = PLAN_FEATURE_ICONS[config.name] ?? [];
    return {
        ...config,
        features: config.features.map((text, i) => ({
            text,
            icon: icons[i] ?? Globe
        }))
    };
});
