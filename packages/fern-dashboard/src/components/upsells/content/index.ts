import type { ProductTier } from "@fern-platform/billing";
import type { ComponentType } from "react";

import type { UpsellContentProps, UpsellFeature } from "../types";
import { SeatCounterContent } from "./SeatCounterContent";

/**
 * Maps upsell features + tiers to custom content components.
 * Kept separate from configs.ts to avoid pulling server-only
 * dependencies into test contexts.
 */
export const UPSELL_CONTENT: Partial<
    Record<UpsellFeature, Partial<Record<ProductTier, ComponentType<UpsellContentProps>>>>
> = {
    seats: {
        paid: SeatCounterContent
    }
};
