"use client";

import { MAX_PRO_TOTAL_SEATS } from "@fern-platform/billing";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { createAddonSeatsCheckout } from "@/app/actions/billing/createAddonSeatsCheckout";
import { createPortalSession } from "@/app/actions/billing/createPortalSession";
import {
    type AddonSeatsPricePreview,
    getAddonSeatsPricePreview
} from "@/app/actions/billing/getAddonSeatsPricePreview";
import { syncAfterCheckout } from "@/app/actions/billing/syncAfterCheckout";
import { getPylon } from "@/components/pylon/getPylon";
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
    const isAtLimit = usedMembers >= currentMembers && currentMembers > 0;

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
        }, 750);

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

    const handleManagePaymentMethod = useCallback(async () => {
        if (!org?.name) {
            return;
        }
        const result = await createPortalSession({ orgId, orgSlug: org.name });
        if ("url" in result) {
            window.open(result.url, "_blank", "noopener,noreferrer");
        }
    }, [orgId, org?.name]);

    const isAdding = seatsDelta > 0;
    const isRemoving = seatsDelta < 0;
    const absDelta = Math.abs(seatsDelta);
    const periodLabel = pricePreview?.billingInterval === "year" ? "yr" : "mo";

    return (
        <div className="flex flex-col gap-6">
            {/* Description */}
            <div className="flex flex-col gap-2">
                {isAtLimit && (
                    <p className="text-sm font-bold leading-4 text-[#1e1f24] dark:text-[#e8e9f0]">
                        You are at your member limit.
                    </p>
                )}
                <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                    You have assigned {usedMembers} of {currentMembers} members on your plan.
                </p>
            </div>

            {/* Counter */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setCount((c) => Math.max(usedMembers, c - 1))}
                    disabled={count <= usedMembers || isLoading}
                    className="flex size-8 items-center justify-center rounded-[6px] border border-[#e0e1e6] bg-white text-[#1e1f24] shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:text-[#e8e9f0] dark:hover:bg-[#2a2b31]"
                >
                    <Minus className="size-4" />
                </button>
                <span className="w-8 text-center text-sm font-medium text-[#1e1f24] dark:text-[#e8e9f0]">{count}</span>
                <button
                    onClick={() => setCount((c) => Math.min(MAX_PRO_TOTAL_SEATS + 1, c + 1))}
                    disabled={count > MAX_PRO_TOTAL_SEATS || isLoading}
                    className="flex size-8 items-center justify-center rounded-[6px] border border-[#e0e1e6] bg-white text-[#1e1f24] shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:text-[#e8e9f0] dark:hover:bg-[#2a2b31]"
                >
                    <Plus className="size-4" />
                </button>
                <span className="text-sm text-[#80828d] dark:text-[#9a9ba6]">members</span>
            </div>

            {/* Line items — shown when seat count changed and price preview loaded */}
            {seatsDelta !== 0 && (
                <>
                    {isPriceLoading || !pricePreview ? (
                        <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                            {isPriceLoading ? "Calculating\u2026" : ""}
                        </p>
                    ) : (
                        <>
                            {/* Separator */}
                            <div className="h-px bg-[#e0e1e6] dark:bg-[#2e2f35]" />

                            {/* Members row */}
                            <div className="flex items-center justify-between text-sm text-[#008700] dark:text-[#00a300]">
                                <span>Members</span>
                                <span className="font-mono">
                                    {absDelta} * {formatCentsAsDollars(pricePreview.perSeatCost, pricePreview.currency)}
                                    /member/{periodLabel}
                                </span>
                            </div>

                            {/* Separator */}
                            <div className="h-px bg-[#e0e1e6] dark:bg-[#2e2f35]" />

                            {/* Change row */}
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-bold text-[#1e1f24] dark:text-[#e8e9f0]">Change</span>
                                <span className="font-mono font-bold text-[#1e1f24] dark:text-[#e8e9f0]">
                                    {isAdding ? "+" : "-"}
                                    {formatCentsAsDollars(
                                        Math.abs(pricePreview.seatDeltaSubtotal),
                                        pricePreview.currency
                                    )}{" "}
                                    {pricePreview.billingInterval === "year" ? "yearly" : "monthly"}
                                </span>
                            </div>

                            {/* Proration note */}
                            <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                                Prorated for the rest of this cycle. Taxes may apply.
                            </p>
                        </>
                    )}
                </>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    className="h-8 rounded-[6px] border-[#e8e8eb] px-3 text-sm text-[#3d3e45] dark:border-[#3e3f46] dark:text-[#c5c7d0]"
                    onClick={onClose}
                >
                    Cancel
                </Button>
                <Button
                    className="h-8 rounded-[6px] bg-[#008700] px-3 text-sm text-white hover:bg-[#007600] disabled:opacity-50 dark:bg-[#00a300] dark:hover:bg-[#008700]"
                    disabled={seatsDelta === 0 || isLoading || isPriceLoading || count > MAX_PRO_TOTAL_SEATS}
                    onClick={handleUpdateSeats}
                >
                    {isLoading ? (isRemoving ? "Removing\u2026" : "Adding\u2026") : "Confirm"}
                </Button>
            </div>

            {/* Pro seat limit callout */}
            {count > MAX_PRO_TOTAL_SEATS && (
                <div className="flex flex-col items-end gap-3 rounded-xl border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] p-4 dark:border-[rgba(220,38,38,0.4)] dark:bg-[rgba(220,38,38,0.15)]">
                    <div className="flex w-full items-center gap-3">
                        <AlertTriangle className="size-5 shrink-0 text-[#dc2626]" />
                        <p className="min-w-0 flex-1 text-sm leading-4 text-[#dc2626]">
                            To add more than {MAX_PRO_TOTAL_SEATS} members, please upgrade your plan.
                        </p>
                    </div>
                    <Button
                        variant="dark"
                        size="sm"
                        onClick={() => {
                            getPylon()?.("show");
                            getPylon()?.("showChatBubble");
                        }}
                    >
                        Contact us to upgrade
                    </Button>
                </div>
            )}

            {/* Payment error callout */}
            {errorMessage != null && (
                <div className="flex flex-col items-end gap-3 rounded-xl border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] p-4 dark:border-[rgba(220,38,38,0.4)] dark:bg-[rgba(220,38,38,0.15)]">
                    <div className="flex w-full items-start gap-3">
                        <AlertTriangle className="size-6 shrink-0 text-[#dc2626]" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <p className="text-sm leading-4 text-[#dc2626]">Oops! Payment failed.</p>
                            <p className="text-sm leading-4 text-[#6b7280] dark:text-[#9ca3af]">{errorMessage}</p>
                        </div>
                    </div>
                    <Button variant="dark" size="sm" onClick={handleManagePaymentMethod}>
                        Manage payment method
                    </Button>
                </div>
            )}
        </div>
    );
}
