"use client";

import { ADDON_SEAT_PRICE_DOLLARS, MAX_ADDON_SEATS } from "@fern-platform/billing";
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

import { UPSELL_CONFIGS } from "../configs";
import type { UpsellContentProps } from "../types";
import { useIsTrialing } from "../useIsTrialing";
import { formatCentsAsDollars } from "./formatCentsAsDollars";

export function SeatCounterContent({ orgId, onClose }: UpsellContentProps) {
    const router = useRouter();
    const org = useCurrentOrganization();
    const { used, limit, refetch } = useEntitlement("seats");

    const isTrialing = useIsTrialing();
    const [count, setCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [pricePreview, setPricePreview] = useState<AddonSeatsPricePreview | null>(null);
    const [isPriceLoading, setIsPriceLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const learnMoreUrl = UPSELL_CONFIGS.seats.tierOverrides?.paid?.learnMoreUrl;
    const currentMembers = limit != null && limit !== Infinity ? limit : 0;
    const usedMembers = used ?? 0;

    const minTotal = usedMembers;
    const minCount = Math.max(0, minTotal - currentMembers);

    // Clear error when count changes
    useEffect(() => {
        setErrorMessage(null);
    }, []);

    // Fetch live price preview debounced when count changes
    useEffect(() => {
        if (count === 0 || !org?.name) {
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
                seatsToAdd: count
            });
            if ("preview" in result) {
                setPricePreview(result.preview ?? null);
            } else {
                setPricePreview(null);
            }
            setIsPriceLoading(false);
        }, 350);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [count, orgId, org?.name]);

    const handleAddSeats = useCallback(async () => {
        if (count === 0 || !org?.name) {
            return;
        }

        if (currentMembers + count < usedMembers) {
            setErrorMessage(
                `Member count can't be less than your current ${usedMembers} member${usedMembers !== 1 ? "s" : ""}. Adjust the count or remove members to continue.`
            );
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            const result = await createAddonSeatsCheckout({
                orgId,
                orgName: org.name,
                seatsToAdd: count
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
            setErrorMessage("Failed to add seats. Please try again.");
            setIsLoading(false);
        }
    }, [count, orgId, org?.name, currentMembers, usedMembers, refetch, onClose, router.refresh]);

    const handleLearnMore = useCallback(() => {
        if (learnMoreUrl) {
            window.open(learnMoreUrl, "_blank", "noopener,noreferrer");
        }
    }, [learnMoreUrl]);

    return (
        <div className="flex flex-col gap-4">
            {/* Current seat count */}
            <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                Your plan currently includes {limit} seats.
            </p>

            {/* Counter */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCount((c) => Math.max(minCount, c - 1))}
                        disabled={count <= minCount || isLoading}
                        className="flex size-8 items-center justify-center rounded-[6px] border border-[#e0e1e6] bg-white text-[#1e1f24] shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:text-[#e8e9f0] dark:hover:bg-[#2a2b31]"
                    >
                        <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-[#1e1f24] dark:text-[#e8e9f0]">
                        {count}
                    </span>
                    <button
                        onClick={() => setCount((c) => Math.min(MAX_ADDON_SEATS, c + 1))}
                        disabled={count >= MAX_ADDON_SEATS || isLoading}
                        className="flex size-8 items-center justify-center rounded-[6px] border border-[#e0e1e6] bg-white text-[#1e1f24] shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:text-[#e8e9f0] dark:hover:bg-[#2a2b31]"
                    >
                        <Plus className="size-4" />
                    </button>
                </div>
                <span className="text-sm text-[#80828d] dark:text-[#9a9ba6]">members</span>
            </div>

            {/* Inline error */}
            {errorMessage != null && <p className="text-sm leading-4 text-red-600 dark:text-red-400">{errorMessage}</p>}

            {/* Price breakdown — shown when count > 0 and no error */}
            {count > 0 && errorMessage == null && (
                <div className="flex flex-col gap-1 border-t border-[#e0e1e6] pt-4 dark:border-[#2e2f35]">
                    {isPriceLoading || !pricePreview ? (
                        <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                            {isPriceLoading ? "Calculating…" : ""}
                        </p>
                    ) : (
                        <>
                            <div className="flex justify-between text-sm text-[#80828d] dark:text-[#9a9ba6]">
                                <span>Subtotal</span>
                                <span>{formatCentsAsDollars(pricePreview.subtotal, pricePreview.currency)}</span>
                            </div>
                            {pricePreview.dueNowTax > 0 && (
                                <div className="flex justify-between text-sm text-[#80828d] dark:text-[#9a9ba6]">
                                    <span>Tax</span>
                                    <span>{formatCentsAsDollars(pricePreview.dueNowTax, pricePreview.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold text-[#1e1f24] dark:text-[#e8e9f0]">
                                <span>Due now</span>
                                <span>{formatCentsAsDollars(pricePreview.dueNow, pricePreview.currency)}</span>
                            </div>
                            {isTrialing && (
                                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                    You&apos;re on a trial. Addon seats will be charged at ${ADDON_SEAT_PRICE_DOLLARS}
                                    /seat/month after your trial ends.
                                </p>
                            )}
                            {pricePreview.monthlyPerSeat > 0 && (
                                <p className="mt-1 text-xs text-[#80828d] dark:text-[#9a9ba6]">
                                    Then{" "}
                                    {formatCentsAsDollars(pricePreview.monthlyPerSeat * count, pricePreview.currency)}{" "}
                                    more per month going forward.
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2">
                {learnMoreUrl && (
                    <Button
                        variant="outline"
                        className="h-8 rounded-md border-[#e8e8eb] px-3 text-sm text-[#3d3e45] dark:border-[#3e3f46] dark:text-[#c5c7d0]"
                        onClick={handleLearnMore}
                        disabled={isLoading}
                    >
                        Learn more
                    </Button>
                )}
                <Button
                    className="h-8 rounded-md bg-[#008700] px-3 text-sm text-white hover:bg-[#007600] dark:bg-[#00a300] dark:hover:bg-[#008700]"
                    disabled={count === 0 || isLoading || isPriceLoading}
                    onClick={handleAddSeats}
                >
                    {isLoading ? "Adding seats…" : "Add seats"}
                </Button>
            </div>
        </div>
    );
}
