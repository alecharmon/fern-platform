"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { useEntitlement } from "@/state/useEntitlement";
import { useCurrentOrganization } from "@/state/useOrganizations";
import { Button } from "../ui/button";

export function SeatUpsell() {
    const posthog = usePostHog();
    const org = useCurrentOrganization();
    const { isEntitled: canPurchaseSeats } = useEntitlement("can_purchase_additional_seats");

    useEffect(() => {
        captureEvent(posthog, PosthogEventName.BILLING_LIMIT_HIT, { limitType: "seats" });
    }, [posthog]);

    return (
        <Button variant="default" asChild>
            <Link
                href={`/${org?.name}/billing`}
                onClick={() => captureEvent(posthog, PosthogEventName.UPGRADE_CTA_CLICKED, { source: "seat_upsell" })}
            >
                <ArrowUpRight />
                {canPurchaseSeats ? "Add more seats" : "Upgrade to add members"}
            </Link>
        </Button>
    );
}
