"use client";

import { ADDON_SEAT_PRICE_DOLLARS, MAX_ADDON_SEATS } from "@fern-platform/billing";
import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updateAddonSeats } from "@/app/actions/billing/updateAddonSeats";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/providers/EntitlementsProvider";

export function AddSeatsCard({
    orgId,
    orgName,
    currentAddonSeats
}: {
    orgId: string;
    orgName: Auth0OrgName;
    currentAddonSeats: number;
}) {
    const posthog = usePostHog();
    const { entitlements, refetch } = useEntitlements();
    const router = useRouter();
    const seatsResult = entitlements?.seats;

    const serverLimit =
        seatsResult == null
            ? undefined
            : seatsResult.entitled === true
              ? seatsResult.type === "quantity"
                  ? seatsResult.limit
                  : undefined
              : seatsResult.limit;

    const used =
        seatsResult == null
            ? undefined
            : seatsResult.entitled === true
              ? seatsResult.type === "quantity"
                  ? seatsResult.used
                  : undefined
              : seatsResult.used;

    const [optimisticExtra, setOptimisticExtra] = useState(0);
    const limit = serverLimit != null ? serverLimit + optimisticExtra : undefined;

    const [quantity, setQuantity] = useState(currentAddonSeats);
    const [isUpdating, setIsUpdating] = useState(false);
    const refetchTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    // Sync quantity when prop changes (e.g. after refetch)
    useEffect(() => {
        setQuantity(currentAddonSeats);
    }, [currentAddonSeats]);

    // Cleanup refetch timers on unmount
    useEffect(() => {
        return () => {
            for (const timer of refetchTimersRef.current) {
                clearTimeout(timer);
            }
        };
    }, []);

    // Base plan seats = total limit minus addon seats. Addon quantity can't go below
    // the number needed to cover current usage.
    const basePlanSeats = (serverLimit ?? 0) - currentAddonSeats;
    const minAddonSeats = Math.max(0, (used ?? 0) - basePlanSeats);

    const hasChanged = quantity !== currentAddonSeats;
    const delta = quantity - currentAddonSeats;

    const handleUpdateSeats = useCallback(async () => {
        if (!hasChanged) {
            return;
        }

        setIsUpdating(true);
        try {
            const result = await updateAddonSeats({ orgId, orgName, quantity });

            if ("error" in result) {
                console.error("[AddSeatsCard] Failed to update seats:", result.error);
                toast.error(result.error);
                return;
            }

            captureEvent(posthog, PosthogEventName.ADDON_SEATS_UPDATED, {
                previousQuantity: currentAddonSeats,
                newQuantity: quantity,
                delta
            });

            const verb = delta > 0 ? "Added" : "Removed";
            const count = Math.abs(delta);
            toast.success(`${verb} ${count} seat${count > 1 ? "s" : ""}.`);

            const confirmedDelta = delta;
            setOptimisticExtra((prev) => prev + confirmedDelta);

            // Clear any pending refetch timers from a previous update
            for (const timer of refetchTimersRef.current) {
                clearTimeout(timer);
            }
            refetchTimersRef.current = [];

            // Staggered refetch: try at 2s, 5s, 10s to account for webhook propagation
            const delays = [2000, 5000, 10000];
            for (const delay of delays) {
                const timer = setTimeout(async () => {
                    const refetchResult = await refetch();
                    router.refresh();

                    // Check if the server data now reflects the new seat count
                    const seats = refetchResult?.seats;
                    if (seats == null) {
                        return;
                    }
                    const newServerLimit =
                        seats.entitled === true ? (seats.type === "quantity" ? seats.limit : undefined) : seats.limit;

                    if (
                        newServerLimit != null &&
                        newServerLimit >= (serverLimit ?? 0) + optimisticExtra + confirmedDelta
                    ) {
                        // Server caught up — clear the delta this update contributed
                        setOptimisticExtra((prev) => prev - confirmedDelta);
                        // Clear remaining timers
                        for (const t of refetchTimersRef.current) {
                            clearTimeout(t);
                        }
                        refetchTimersRef.current = [];
                    }
                }, delay);
                refetchTimersRef.current.push(timer);
            }
        } catch (error) {
            console.error("[AddSeatsCard] Error:", error);
            toast.error("Failed to update seats. Please try again.");
        } finally {
            setIsUpdating(false);
        }
    }, [
        orgId,
        orgName,
        quantity,
        hasChanged,
        delta,
        refetch,
        router,
        serverLimit,
        optimisticExtra,
        currentAddonSeats,
        posthog
    ]);

    const costDelta = delta * ADDON_SEAT_PRICE_DOLLARS;

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-gray-100 p-4">
            <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-foreground">Add-on seats</h3>
                {limit != null && used != null && (
                    <div className="flex flex-col gap-0.5">
                        <p className="text-sm text-gray-1000">
                            Using <span className="font-medium text-foreground">{used}</span> of{" "}
                            <span className="font-medium text-foreground">{limit}</span> seats
                        </p>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setQuantity((q) => Math.max(minAddonSeats, q - 1))}
                            disabled={quantity <= minAddonSeats || isUpdating}
                            className="flex size-8 items-center justify-center rounded-md border border-border bg-white text-foreground shadow-sm hover:bg-secondary disabled:opacity-40"
                        >
                            <Minus className="size-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
                        <button
                            onClick={() => setQuantity((q) => Math.min(MAX_ADDON_SEATS, q + 1))}
                            disabled={quantity >= MAX_ADDON_SEATS || isUpdating}
                            className="flex size-8 items-center justify-center rounded-md border border-border bg-white text-foreground shadow-sm hover:bg-secondary disabled:opacity-40"
                        >
                            <Plus className="size-4" />
                        </button>
                    </div>
                    {hasChanged && (
                        <p className="text-sm text-gray-1000">
                            {costDelta > 0 ? `+$${costDelta}` : `-$${Math.abs(costDelta)}`}/mo to your subscription
                        </p>
                    )}
                </div>
                <Button variant="default" size="sm" disabled={isUpdating || !hasChanged} onClick={handleUpdateSeats}>
                    {isUpdating
                        ? "Updating..."
                        : !hasChanged
                          ? `${currentAddonSeats} add-on seat${currentAddonSeats !== 1 ? "s" : ""}`
                          : delta > 0
                            ? `Add ${delta} seat${delta > 1 ? "s" : ""}`
                            : `Remove ${Math.abs(delta)} seat${Math.abs(delta) > 1 ? "s" : ""}`}
                </Button>
            </div>
        </div>
    );
}
