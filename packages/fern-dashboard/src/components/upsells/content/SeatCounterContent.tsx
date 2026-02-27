"use client";

import { MAX_ADDON_SEATS } from "@fern-platform/billing";
import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { createAddonSeatsCheckout } from "@/app/actions/billing/createAddonSeatsCheckout";
import {
    type AddonSeatsPricePreview,
    getAddonSeatsPricePreview
} from "@/app/actions/billing/getAddonSeatsPricePreview";
import { syncAfterCheckout } from "@/app/actions/billing/syncAfterCheckout";
import { Button } from "@/components/ui/button";
import { useEntitlement } from "@/state/useEntitlement";
import { useCurrentOrganization } from "@/state/useOrganizations";

import type { UpsellContentProps } from "../types";
import { formatCentsAsDollars } from "./formatCentsAsDollars";

export function SeatCounterContent({ orgId, onClose }: UpsellContentProps) {
    const router = useRouter();
    const org = useCurrentOrganization();
    const { used, limit, refetch } = useEntitlement("seats");

    const [count, setCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [pricePreview, setPricePreview] = useState<AddonSeatsPricePreview | null>(null);
    const [isPriceLoading, setIsPriceLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentMembers = limit != null && limit !== Infinity ? limit : 0;
    const usedMembers = used ?? 0;
    const seatsDelta = count - currentMembers;

    // Initialize count to current seat limit when it loads
    useEffect(() => {
        if (limit != null && limit !== Infinity) {
            setCount(limit);
        }
    }, [limit]);

    // Clear error when count changes
    useEffect(() => {
        setErrorMessage(null);
    }, []);

    // Fetch live price preview debounced when seat delta changes
    useEffect(() => {
        if (seatsDelta === 0 || !org?.name) {
            setPricePreview(null);
            return;
        }

        setIsPriceLoading(true);
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
            const result = await getAddonSeatsPricePreview({
                orgId,
                orgName: org.name,
                seatsToAdd: seatsDelta
            });
            if ("preview" in result) {
                setPricePreview(result.preview ?? null);
            } else {
                setPricePreview(null);
                setErrorMessage(result.error);
            }
            setIsPriceLoading(false);
        }, 350);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [seatsDelta, orgId, org?.name]);

    const handleUpdateSeats = useCallback(async () => {
        if (seatsDelta === 0 || !org?.name) {
            return;
        }

        if (count < usedMembers) {
            setErrorMessage(
                `Member count can't be less than your current ${usedMembers} member${usedMembers !== 1 ? "s" : ""}. Remove members to continue.`
            );
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            const result = await createAddonSeatsCheckout({
                orgId,
                orgName: org.name,
                seatsToAdd: seatsDelta
            });
            if ("error" in result) {
                setErrorMessage(result.error);
                setIsLoading(false);
                return;
            }
            await syncAfterCheckout({ orgId });
            await refetch();
            router.refresh();
            onClose();
        } catch {
            setErrorMessage("Failed to update seats. Please try again.");
            setIsLoading(false);
        }
    }, [seatsDelta, count, orgId, org?.name, usedMembers, refetch, onClose, router]);

    const isAdding = seatsDelta > 0;
    const isRemoving = seatsDelta < 0;
    const absDelta = Math.abs(seatsDelta);
    const periodLabel = pricePreview?.billingInterval === "year" ? "yr" : "mo";

    return (
        <div className="flex flex-col gap-6">
            {/* Description */}
            <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                You have assigned {usedMembers} of {currentMembers} members on your plan.
            </p>

            {/* Counter + per-seat price */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCount((c) => Math.max(usedMembers, c - 1))}
                        disabled={count <= usedMembers || isLoading}
                        className="flex size-8 items-center justify-center rounded-[6px] border border-[#e0e1e6] bg-white text-[#1e1f24] shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:text-[#e8e9f0] dark:hover:bg-[#2a2b31]"
                    >
                        <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-[#1e1f24] dark:text-[#e8e9f0]">
                        {count}
                    </span>
                    <button
                        onClick={() => setCount((c) => Math.min(currentMembers + MAX_ADDON_SEATS, c + 1))}
                        disabled={count >= currentMembers + MAX_ADDON_SEATS || isLoading}
                        className="flex size-8 items-center justify-center rounded-[6px] border border-[#e0e1e6] bg-white text-[#1e1f24] shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:text-[#e8e9f0] dark:hover:bg-[#2a2b31]"
                    >
                        <Plus className="size-4" />
                    </button>
                    <span className="text-sm text-[#80828d] dark:text-[#9a9ba6]">members</span>
                </div>
                {pricePreview && pricePreview.perSeatCost > 0 && (
                    <p className="text-xs leading-[14px] text-[#80828d] dark:text-[#9a9ba6]">
                        {formatCentsAsDollars(pricePreview.perSeatCost, pricePreview.currency)} / member / {periodLabel}
                    </p>
                )}
            </div>

            {/* Price breakdown — shown when seat count changed */}
            {seatsDelta !== 0 && (
                <>
                    {isPriceLoading || !pricePreview ? (
                        <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                            {isPriceLoading ? "Calculating…" : ""}
                        </p>
                    ) : (
                        <>
                            {/* Separator */}
                            <div className="h-px bg-[#e0e1e6] dark:bg-[#2e2f35]" />

                            {/* Breakdown rows */}
                            <div className="flex flex-col gap-4">
                                {/* Seat delta row — green */}
                                <div
                                    className={`flex items-center justify-between text-sm ${
                                        isAdding
                                            ? "text-[#008700] dark:text-[#00a300]"
                                            : "text-[#62636c] dark:text-[#9a9ba6]"
                                    }`}
                                >
                                    <span>
                                        {isAdding
                                            ? `${absDelta} additional member${absDelta !== 1 ? "s" : ""}`
                                            : `${absDelta} less member${absDelta !== 1 ? "s" : ""}`}
                                    </span>
                                    <span className="font-mono">
                                        {isAdding ? "+" : "-"}
                                        {formatCentsAsDollars(
                                            Math.abs(pricePreview.seatDeltaSubtotal),
                                            pricePreview.currency
                                        ).replace("$", "")}
                                        /{periodLabel}
                                    </span>
                                </div>

                                {/* Current subtotal */}
                                <div className="flex items-center justify-between text-sm text-[#62636c] dark:text-[#9a9ba6]">
                                    <span>
                                        Current {pricePreview.billingInterval === "year" ? "yearly" : "monthly"}{" "}
                                        subtotal
                                    </span>
                                    <span className="font-mono">
                                        {formatCentsAsDollars(
                                            pricePreview.currentRecurringSubtotal,
                                            pricePreview.currency
                                        )}
                                    </span>
                                </div>

                                {/* Taxes & fees */}
                                {pricePreview.taxDelta !== 0 && (
                                    <div className="flex items-center justify-between text-sm text-[#62636c] dark:text-[#9a9ba6]">
                                        <span>Taxes &amp; fees</span>
                                        <span className="font-mono">
                                            {pricePreview.taxDelta < 0 ? "-" : ""}
                                            {formatCentsAsDollars(
                                                Math.abs(pricePreview.taxDelta),
                                                pricePreview.currency
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Separator */}
                            <div className="h-px bg-[#e0e1e6] dark:bg-[#2e2f35]" />

                            {/* New total */}
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-bold text-[#1e1f24] dark:text-[#e8e9f0]">
                                    New {pricePreview.billingInterval === "year" ? "yearly" : "monthly"} total
                                </span>
                                <span className="font-mono font-bold text-[#1e1f24] dark:text-[#e8e9f0]">
                                    {formatCentsAsDollars(pricePreview.newRecurringTotal, pricePreview.currency)}
                                </span>
                            </div>

                            {/* Proration note */}
                            <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                                {isAdding
                                    ? "You\u2019ll be charged a prorated amount for the rest of this billing cycle."
                                    : ""}
                            </p>
                        </>
                    )}
                </>
            )}

            {/* Action button */}
            <div className="flex items-center justify-end">
                <Button
                    className="h-8 rounded-[6px] bg-[#008700] px-3 text-sm text-white hover:bg-[#007600] dark:bg-[#00a300] dark:hover:bg-[#008700]"
                    disabled={seatsDelta === 0 || isLoading || isPriceLoading}
                    onClick={handleUpdateSeats}
                >
                    {isLoading
                        ? isRemoving
                            ? "Removing members…"
                            : "Adding members…"
                        : seatsDelta === 0
                          ? "Add members"
                          : isRemoving
                            ? `Remove ${absDelta} member${absDelta !== 1 ? "s" : ""}`
                            : `Add ${absDelta} member${absDelta !== 1 ? "s" : ""}`}
                </Button>
            </div>

            {/* Error message — shown below button like the Figma design */}
            {errorMessage != null && (
                <p className="text-sm leading-4 text-[#ce2c31] dark:text-red-400">{errorMessage}</p>
            )}
        </div>
    );
}
