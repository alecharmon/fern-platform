"use client";

import { useEntitlement } from "@/state/useEntitlement";
import { Button } from "../ui/button";
import { useUpsell } from "../upsells";

/**
 * Shown in the Members page header when the org is on a paid plan
 * (can_purchase_additional_seats = true). Displays current seat usage
 * and opens the seats upsell modal to add more.
 */
export function SeatUsageButton() {
    const { isEntitled: canPurchaseSeats, isLoading: seatsLoading } = useEntitlement("can_purchase_additional_seats");
    const { used, limit, isLoading: usageLoading } = useEntitlement("seats");
    const { openUpsell } = useUpsell();

    if (!canPurchaseSeats || seatsLoading || usageLoading) {
        return null;
    }

    const label = used != null && limit != null && limit !== Infinity ? `${used}/${limit} members` : "Manage seats";

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={() => openUpsell("seats")}
            className="text-[#3d3e45] dark:text-[#c5c7d0]"
        >
            {label}
        </Button>
    );
}
