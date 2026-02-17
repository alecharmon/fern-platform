"use client";

import { ADDITIONAL_SEATS_SKU, type BillingPlan } from "@fern-platform/billing";
import csharpIcon from "devicon/icons/csharp/csharp-original.svg";
import goIcon from "devicon/icons/go/go-original-wordmark.svg";
import kotlinIcon from "devicon/icons/kotlin/kotlin-original.svg";
import pythonIcon from "devicon/icons/python/python-original.svg";
import rubyIcon from "devicon/icons/ruby/ruby-original.svg";
import rustIcon from "devicon/icons/rust/rust-original.svg";
import swiftIcon from "devicon/icons/swift/swift-original.svg";
import typescriptIcon from "devicon/icons/typescript/typescript-original.svg";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession } from "@/app/actions/billing/createCheckoutSession";
import { createPortalSession } from "@/app/actions/billing/createPortalSession";
import { getBillingPlanAction } from "@/app/actions/billing/getBillingPlan";
import { syncAfterCheckout } from "@/app/actions/billing/syncAfterCheckout";
import { createUpgradeSession } from "@/app/actions/billing/upgradeSubscription";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { ClientEntitlementGate } from "@/components/entitlements/ClientEntitlementGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntitlements } from "@/providers/EntitlementsProvider";
import { useCurrentOrganization } from "@/state/useOrganizations";
import { AddSeatsCard } from "./AddSeatsCard";
import { type BillingCycle, getPlanIndex, type Plan, plans } from "./plans";

const SDK_LANGUAGE_ICONS = [
    { name: "TypeScript", src: typescriptIcon },
    { name: "Python", src: pythonIcon },
    { name: "Go", src: goIcon },
    { name: "Ruby", src: rubyIcon },
    { name: "C#", src: csharpIcon },
    { name: "Kotlin", src: kotlinIcon },
    { name: "Swift", src: swiftIcon },
    { name: "Rust", src: rustIcon }
];

function BillingCardSkeleton() {
    return (
        <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-gray-600 bg-card p-4">
            <Skeleton className="h-5 w-16" />
            <div className="flex flex-col gap-2">
                <Skeleton className="h-[25px] w-24" />
                <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        </div>
    );
}

/**
 * Determine the active plan name from a BillingPlan.
 * Tries exact SKU match first, then falls back to tier-based matching.
 */
function getActivePlanName(billingPlan: BillingPlan): string {
    // Try exact SKU match when planSku is available
    if (billingPlan.planSku != null) {
        for (const plan of plans) {
            if (plan.planSkuMatcher(billingPlan.planSku)) {
                return plan.name;
            }
        }
    }
    // Fall back to tier-based matching
    const tierMatch = plans.find((p) => p.tier === billingPlan.tier);
    return tierMatch?.name ?? "Hobby";
}

export interface BillingInfoProps {
    session: Auth0SessionData;
    showSuperUserPricing?: boolean;
}

export function BillingInfo({ session, showSuperUserPricing = false }: BillingInfoProps) {
    const org = useCurrentOrganization();
    const searchParams = useSearchParams();
    const { refetch: refetchEntitlements } = useEntitlements();
    const [billingPlan, setBillingPlan] = useState<BillingPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const [upgradingToPlan, setUpgradingToPlan] = useState<string | null>(null);
    const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
    const [useSuperUserPricing, setUseSuperUserPricing] = useState(false);

    const hasShownToast = useRef(false);
    const popupRef = useRef<Window | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Clean up popup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    const handlePopupClosed = useCallback(async () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        if (!org) {
            return;
        }
        try {
            await syncAfterCheckout({ orgId: org.id });
            const result = await getBillingPlanAction(org.id);
            if (!("error" in result)) {
                setBillingPlan(result.plan);
                toast.success("Upgrade successful! Your new plan is now active.");
            }
            refetchEntitlements();
        } catch (error) {
            console.error("Error syncing after checkout popup:", error);
        }
    }, [org, refetchEntitlements]);

    useEffect(() => {
        if (!org) {
            return;
        }

        const currentOrg = org;
        const isSuccess = searchParams.get("success") === "true";
        const isUpgrade = searchParams.get("upgrade") === "true";
        const isCanceled = searchParams.get("canceled") === "true";
        const checkoutSessionId = searchParams.get("session_id") ?? undefined;

        // If running inside a popup, auto-close and let the parent handle sync
        if (window.opener != null) {
            if (isSuccess || isUpgrade || isCanceled) {
                window.close();
            }
            return;
        }

        if ((isSuccess || isUpgrade) && !hasShownToast.current) {
            hasShownToast.current = true;
            toast.success("Upgrade successful! Your new plan is now active.");
        }

        async function loadBillingPlan() {
            try {
                // If returning from checkout/upgrade, sync billing data immediately
                // so we don't have to wait for the webhook
                if (isSuccess || isUpgrade) {
                    await syncAfterCheckout({
                        orgId: currentOrg.id,
                        checkoutSessionId
                    });
                }

                const result = await getBillingPlanAction(currentOrg.id);
                if ("error" in result) {
                    console.error("Failed to load billing plan:", result.error);
                } else {
                    setBillingPlan(result.plan);
                }
            } catch (error) {
                console.error("Error loading billing plan:", error);
            } finally {
                setLoading(false);
            }
        }

        loadBillingPlan();
    }, [org, searchParams]);

    const openInPopupOrRedirect = useCallback(
        (url: string) => {
            const popup = window.open(url, "stripe-checkout", "popup,width=600,height=700");
            if (popup == null) {
                // Popup blocked — fall back to full-page redirect
                window.location.href = url;
                return;
            }
            popupRef.current = popup;

            // Poll for popup close
            pollIntervalRef.current = setInterval(() => {
                if (popup.closed) {
                    popupRef.current = null;
                    handlePopupClosed();
                }
            }, 500);
        },
        [handlePopupClosed]
    );

    const handleUpgrade = async (plan: Plan) => {
        if (!org || !session.user.email) {
            return;
        }

        // Enterprise plan - redirect to contact/demo
        if (!plan.cyclePricing) {
            window.open("https://buildwithfern.com/book-demo", "_blank");
            return;
        }

        const priceIds =
            useSuperUserPricing && plan.superUserPriceIds
                ? plan.superUserPriceIds
                : plan.cyclePricing[billingCycle].priceIds;

        setUpgradingToPlan(plan.name);
        try {
            if (billingPlan?.subscription) {
                const result = await createUpgradeSession({
                    orgId: org.id,
                    orgSlug: org.name,
                    priceIds,
                    baseUrl: window.location.origin
                });

                if ("error" in result) {
                    console.error("Failed to create upgrade session:", result.error);
                    alert(result.error);
                } else {
                    openInPopupOrRedirect(result.url);
                }
            } else {
                const result = await createCheckoutSession({
                    orgId: org.id,
                    orgName: org.display_name || org.name,
                    orgSlug: org.name,
                    userEmail: session.user.email,
                    priceIds
                });

                if ("error" in result) {
                    console.error("Failed to create checkout session:", result.error);
                    alert("Failed to start checkout. Please try again.");
                } else {
                    openInPopupOrRedirect(result.url);
                }
            }
        } catch (error) {
            console.error("Error during upgrade:", error);
            alert("Failed to start upgrade. Please try again.");
        } finally {
            setUpgradingToPlan(null);
        }
    };

    const handleManageBilling = async () => {
        if (!org) {
            return;
        }

        setIsOpeningPortal(true);
        try {
            const result = await createPortalSession({
                orgId: org.id,
                orgSlug: org.name
            });

            if ("error" in result) {
                console.error("Failed to create portal session:", result.error);
                alert("Failed to open billing portal. Please try again.");
            } else {
                window.open(result.url, "_blank", "noopener,noreferrer");
            }
        } catch (error) {
            console.error("Error opening billing portal:", error);
            alert("Failed to open billing portal. Please try again.");
        } finally {
            setIsOpeningPortal(false);
        }
    };

    if (!org) {
        return null;
    }

    if (loading) {
        return (
            <div className="flex w-full max-w-[1040px] flex-col gap-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-9 w-28 rounded-md" />
                </div>
                <div className="flex gap-4">
                    {[1, 2, 3].map((i) => (
                        <BillingCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    const currentPlanName = billingPlan ? getActivePlanName(billingPlan).toLowerCase() : "hobby";

    const currentPlanIndex = getPlanIndex(currentPlanName);

    const isOnFreePlan = currentPlanName === "hobby";

    const isDowngrade = (planName: string): boolean => {
        const planIndex = getPlanIndex(planName);
        return planIndex < currentPlanIndex;
    };

    return (
        <div className="flex w-full max-w-[1040px] flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Billing</h1>
                <div className="flex items-center gap-2">
                    {/* Billing cycle toggle */}
                    <div className="flex rounded-lg border border-border bg-secondary p-0.5">
                        <button
                            onClick={() => {
                                setBillingCycle("monthly");
                                setUseSuperUserPricing(false);
                            }}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                billingCycle === "monthly" && !useSuperUserPricing
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-gray-1000 hover:text-gray-1100"
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => {
                                setBillingCycle("yearly");
                                setUseSuperUserPricing(false);
                            }}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                billingCycle === "yearly" && !useSuperUserPricing
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-gray-1000 hover:text-gray-1100"
                            }`}
                        >
                            Yearly (Save 25%)
                        </button>
                        {showSuperUserPricing && (
                            <button
                                onClick={() => setUseSuperUserPricing(true)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                    useSuperUserPricing
                                        ? "bg-card text-foreground shadow-sm"
                                        : "text-gray-1000 hover:text-gray-1100"
                                }`}
                            >
                                Free (SUPERUSER)
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <p className="text-sm text-gray-1000">Get started for free with a 14 day trial. No credit card required.</p>

            {/* Plan Cards */}
            <div className="flex gap-4">
                {plans.map((plan) => {
                    const isActivePlan = plan.name.toLowerCase() === currentPlanName;
                    const isPlanDowngrade = isDowngrade(plan.name);
                    const isHighlighted = plan.tier === "paid";
                    const isDisabled = isActivePlan || isPlanDowngrade || upgradingToPlan === plan.name;

                    // Resolve display pricing: super-user free override, cycle-specific, or static
                    const isSuperUserFree = useSuperUserPricing && plan.superUserPriceIds != null;
                    const cyclePricing = plan.cyclePricing?.[billingCycle];
                    const displayPrice = isSuperUserFree ? "$0" : (cyclePricing?.displayPrice ?? plan.price);
                    const displayPeriod = isSuperUserFree ? "/mo" : (cyclePricing?.period ?? plan.period);

                    return (
                        <div
                            key={plan.name}
                            className={`relative flex flex-1 flex-col gap-4 overflow-hidden rounded-2xl p-4 ${
                                isHighlighted && isOnFreePlan ? "border-2 border-transparent" : "border border-gray-600"
                            }`}
                        >
                            {/* Background */}
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 rounded-2xl bg-card"
                            />
                            {/* Gradient border for highlighted non-active plan */}
                            {isHighlighted && isOnFreePlan && (
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
                                    style={{
                                        padding: "2px",
                                        background: "linear-gradient(to bottom, #a7bff7, #34d399)",
                                        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                        WebkitMaskComposite: "xor",
                                        maskComposite: "exclude"
                                    }}
                                />
                            )}

                            {/* Plan name */}
                            <h3 className="relative z-10 text-base font-bold text-foreground">{plan.name}</h3>

                            {/* Pricing */}
                            <div className="relative z-10 flex flex-col gap-2">
                                <p className="text-xl font-bold text-foreground">
                                    {displayPrice}
                                    {displayPeriod && <span className="text-base font-bold">{displayPeriod}</span>}
                                </p>
                            </div>

                            {/* Description */}
                            <p className="relative z-10 text-sm text-gray-1100">{plan.description}</p>

                            {/* CTA Button */}
                            <div className="relative z-10">
                                {isActivePlan ? (
                                    <button
                                        disabled
                                        className="flex h-10 w-full items-center justify-center rounded-lg border border-gray-400 bg-card px-4 py-3 text-sm text-foreground shadow-sm"
                                    >
                                        Current plan
                                    </button>
                                ) : isPlanDowngrade ? (
                                    <button
                                        disabled
                                        className="flex h-10 w-full items-center justify-center rounded-lg border border-gray-400 bg-card px-4 py-3 text-sm text-gray-1000 shadow-sm"
                                    >
                                        Included
                                    </button>
                                ) : plan.buttonStyle === "primary" ? (
                                    <button
                                        onClick={() => !isDisabled && handleUpgrade(plan)}
                                        disabled={isDisabled}
                                        className="flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
                                    >
                                        {upgradingToPlan === plan.name ? "Loading..." : plan.buttonText}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => !isDisabled && handleUpgrade(plan)}
                                        disabled={isDisabled}
                                        className="flex h-10 w-full items-center justify-center rounded-lg border border-gray-400 bg-card px-4 py-3 text-sm text-foreground shadow-sm hover:bg-secondary disabled:opacity-60"
                                    >
                                        {upgradingToPlan === plan.name ? "Loading..." : plan.buttonText}
                                    </button>
                                )}
                            </div>

                            {/* Features */}
                            <div className="relative z-10 flex flex-col gap-2">
                                {plan.featureHeader && (
                                    <span className="text-sm text-gray-1000">{plan.featureHeader}</span>
                                )}
                                {plan.features.map((feature, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <feature.icon className="size-5 shrink-0 text-gray-1000" />
                                        <span className="text-sm text-gray-1000">{feature.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* SDK Banner */}
            <div className="rounded-xl border border-border bg-gray-100 p-4">
                <h3 className="text-base font-bold text-foreground">Add SDKs that sync with your Docs</h3>
                <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {SDK_LANGUAGE_ICONS.map(({ name, src }) => (
                            <Image key={name} src={src} alt={name} width={16} height={16} />
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open("https://buildwithfern.com/book-demo", "_blank")}
                    >
                        Contact sales
                    </Button>
                </div>
            </div>

            <ClientEntitlementGate required="can_purchase_additional_seats">
                <AddSeatsCard
                    orgId={org.id}
                    orgName={org.name}
                    currentAddonSeats={
                        billingPlan?.products
                            .filter((p) => p.kind === "addon" && p.sku === ADDITIONAL_SEATS_SKU)
                            .reduce((sum, p) => sum + p.qty, 0) ?? 0
                    }
                />
            </ClientEntitlementGate>

            {/* Manage Subscription Card */}
            {billingPlan?.hasSubscriptionHistory === true && (
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-gray-100 p-4">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-base font-bold text-foreground">Manage your subscription</h3>
                        <p className="text-sm text-gray-1000">
                            View invoices for past payments, update your billing details, or cancel your subscription.
                        </p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={handleManageBilling}
                            disabled={isOpeningPortal}
                            className="flex h-8 items-center justify-center rounded-md border border-border bg-white px-2 text-xs text-gray-1100 shadow-sm hover:bg-secondary disabled:opacity-60"
                        >
                            {isOpeningPortal ? "Opening..." : "View invoices"}
                        </button>
                        <button
                            onClick={handleManageBilling}
                            disabled={isOpeningPortal}
                            className="flex h-8 items-center justify-center rounded-md border border-border bg-white px-2 text-xs text-gray-1100 shadow-sm hover:bg-secondary disabled:opacity-60"
                        >
                            {isOpeningPortal ? "Opening..." : "View billing portal"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
