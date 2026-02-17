"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEntitlement } from "@/state/useEntitlement";
import { useCurrentOrganization } from "@/state/useOrganizations";
import { Button } from "../ui/button";

export function SeatUpsell() {
    const org = useCurrentOrganization();
    const { isEntitled: canPurchaseSeats } = useEntitlement("can_purchase_additional_seats");

    return (
        <Button variant="default" asChild>
            <Link href={`/${org?.name}/billing`}>
                <ArrowUpRight />
                {canPurchaseSeats ? "Add more seats" : "Upgrade to add members"}
            </Link>
        </Button>
    );
}
