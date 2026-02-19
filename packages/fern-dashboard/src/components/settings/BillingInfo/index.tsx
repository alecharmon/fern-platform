"use client";

import { ADDITIONAL_SEATS_SKU, type BillingPlan } from "@fern-platform/billing";
import csharpIcon from "devicon/icons/csharp/csharp-original.svg";
import goIcon from "devicon/icons/go/go-original-wordmark.svg";
import pythonIcon from "devicon/icons/python/python-original.svg";
import rubyIcon from "devicon/icons/ruby/ruby-original.svg";
import rustIcon from "devicon/icons/rust/rust-original.svg";
import swiftIcon from "devicon/icons/swift/swift-original.svg";
import typescriptIcon from "devicon/icons/typescript/typescript-original.svg";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession } from "@/app/actions/billing/createCheckoutSession";
import { createPortalSession } from "@/app/actions/billing/createPortalSession";
import { getBillingPlanAction } from "@/app/actions/billing/getBillingPlan";
import { syncAfterCheckout } from "@/app/actions/billing/syncAfterCheckout";
import { createUpgradeSession } from "@/app/actions/billing/upgradeSubscription";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { DashboardTooltip } from "@/components/editor/DashboardTooltip";
import { ClientEntitlementGate } from "@/components/entitlements/ClientEntitlementGate";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntitlements } from "@/providers/EntitlementsProvider";
import { useCurrentOrganization } from "@/state/useOrganizations";
import { AddSeatsCard } from "./AddSeatsCard";
import { PlanCard } from "./PlanCard";
import { type BillingCycle, getPlanIndex, type Plan, plans } from "./plans";

const SDK_LANGUAGE_ICONS = [
    {
        name: "TypeScript",
        src: typescriptIcon,
        href: "https://buildwithfern.com/learn/sdks/generators/typescript/quickstart"
    },
    { name: "Python", src: pythonIcon, href: "https://buildwithfern.com/learn/sdks/generators/python/quickstart" },
    { name: "Go", src: goIcon, href: "https://buildwithfern.com/learn/sdks/generators/go/quickstart" },
    { name: "Ruby", src: rubyIcon, href: "https://buildwithfern.com/learn/sdks/generators/ruby/quickstart" },
    { name: "C#", src: csharpIcon, href: "https://buildwithfern.com/learn/sdks/generators/csharp/quickstart" },
    // { name: "Kotlin", src: kotlinIcon, href: "https://buildwithfern.com/learn/sdks/generators/kotlin/quickstart" },
    { name: "Swift", src: swiftIcon, href: "https://buildwithfern.com/learn/sdks/generators/swift/quickstart" },
    { name: "Rust", src: rustIcon, href: "https://buildwithfern.com/learn/sdks/generators/rust/quickstart" }
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
    const posthog = usePostHog();
    const entitlementEnabled = posthog?.isFeatureEnabled(PosthogFeatureFlag.ENABLE_ENTITLEMENTS);
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
        const syncToastId = toast.info("Syncing your subscription...");
        try {
            await syncAfterCheckout({ orgId: org.id });
            const result = await getBillingPlanAction(org.id);
            if (!("error" in result)) {
                setBillingPlan(result.plan);
                captureEvent(posthog, PosthogEventName.CHECKOUT_COMPLETED, {
                    plan: result.plan?.planSku ?? "unknown_sku"
                });
            }
            refetchEntitlements();
            toast.success("Upgrade successful! Your new plan is now active.", { id: syncToastId });
        } catch (error) {
            console.error("Error syncing after checkout popup:", error);
            toast.dismiss(syncToastId);
        }
    }, [org, posthog, refetchEntitlements]);

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

        async function loadBillingPlan() {
            let syncToastId: string | number | undefined;
            try {
                // If returning from checkout/upgrade, sync billing data immediately
                // so we don't have to wait for the webhook
                if (isSuccess || isUpgrade) {
                    syncToastId = toast.info("Syncing your subscription...");
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

                if ((isSuccess || isUpgrade) && !hasShownToast.current) {
                    hasShownToast.current = true;
                    toast.success("Upgrade successful! Your new plan is now active.", { id: syncToastId });
                    captureEvent(posthog, PosthogEventName.CHECKOUT_CANCELED, {});
                } else if (syncToastId != null) {
                    captureEvent(posthog, PosthogEventName.CHECKOUT_CANCELED, {});

                    toast.dismiss(syncToastId);
                }
            } catch (error) {
                console.error("Error loading billing plan:", error);

                if (syncToastId != null) {
                    toast.dismiss(syncToastId);
                }
            } finally {
                setLoading(false);
            }
        }

        loadBillingPlan();
    }, [org, searchParams, posthog]);

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

        captureEvent(posthog, PosthogEventName.UPGRADE_CTA_CLICKED, {
            source: "billing_page",
            targetPlan: plan.name
        });

        // Static-priced plans (free/enterprise) - redirect to contact/demo
        if (plan.pricing.type === "static") {
            window.open("https://buildwithfern.com/book-demo", "_blank");
            return;
        }

        const priceIds =
            useSuperUserPricing && plan.pricing.superUserPriceIds
                ? plan.pricing.superUserPriceIds
                : plan.pricing.cycles[billingCycle].priceIds;

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
                    captureEvent(posthog, PosthogEventName.CHECKOUT_STARTED, {
                        targetPlan: plan.name,
                        billingCycle,
                        isUpgrade: true
                    });
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
                    captureEvent(posthog, PosthogEventName.CHECKOUT_STARTED, {
                        targetPlan: plan.name,
                        billingCycle,
                        isUpgrade: false
                    });
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
                <div className="flex flex-col gap-4 md:flex-row">
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
    const hasTrialAvailable = isOnFreePlan && billingPlan?.hasSubscriptionHistory !== true;

    const isDowngrade = (planName: string): boolean => {
        const planIndex = getPlanIndex(planName);
        return planIndex < currentPlanIndex;
    };

    const billingReason = searchParams.get("reason");

    return (
        <div className="flex w-full max-w-[1200px] flex-col gap-4">
            {/* Entitlement limit banner */}
            {billingReason === "docs_site_limit" && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                    You&apos;ve reached the docs site limit on your current plan. Upgrade to create additional docs
                    sites.
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

            {/* Plan Cards + View all features wrapper */}
            <div
                className={`flex flex-col gap-4 rounded-[20px] ${isOnFreePlan ? "border border-gray-500 p-4" : ""}`}
                style={
                    isOnFreePlan
                        ? {
                              background:
                                  "linear-gradient(180deg, var(--color-gray-100) 0%, var(--color-gray-300) 100%)"
                          }
                        : undefined
                }
            >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {plans.map((plan, index) => {
                        const cardStatus =
                            plan.name.toLowerCase() === currentPlanName
                                ? ({ status: "current" } as const)
                                : isDowngrade(plan.name)
                                  ? ({
                                        status: "downgrade",
                                        isDowngrading: isOpeningPortal,
                                        onDowngrade: handleManageBilling
                                    } as const)
                                  : ({
                                        status: "upgradable",
                                        isUpgrading: upgradingToPlan === plan.name,
                                        isNextTier: index === currentPlanIndex + 1,
                                        onUpgrade: handleUpgrade
                                    } as const);

                        return (
                            <PlanCard
                                key={plan.name}
                                plan={plan}
                                cardStatus={cardStatus}
                                isOnFreePlan={isOnFreePlan}
                                hasTrialAvailable={hasTrialAvailable}
                                billingCycle={billingCycle}
                                useSuperUserPricing={useSuperUserPricing}
                            />
                        );
                    })}
                </div>

                {/* View all features link */}
                <div className="flex items-center justify-center">
                    <a
                        href="https://buildwithfern.com/pricing#Docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 items-center justify-center rounded-lg border border-gray-400 bg-card px-4 py-3 text-sm text-foreground shadow-sm hover:bg-secondary"
                    >
                        View all features
                    </a>
                </div>
            </div>

            {/* SDK Banner */}
            <div className="rounded-xl border border-border bg-gray-100 p-4">
                <h3 className="text-base font-bold text-foreground">Add SDKs that sync with your Docs</h3>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-4">
                        {SDK_LANGUAGE_ICONS.map(({ name, src, href }) => (
                            <DashboardTooltip key={name} content={name}>
                                <a href={href} target="_blank" rel="noopener noreferrer">
                                    <Image src={src} alt={name} width={16} height={16} />
                                </a>
                            </DashboardTooltip>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href="https://buildwithfern.com/learn/sdks/overview/how-it-works"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-1000 underline"
                        >
                            Learn more
                        </a>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open("https://buildwithfern.com/book-demo", "_blank")}
                        >
                            Contact sales
                        </Button>
                    </div>
                </div>
            </div>

            {!isOnFreePlan && entitlementEnabled && (
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
            )}

            {/* Manage Subscription Card */}
            {billingPlan?.hasSubscriptionHistory === true && (
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-gray-100 p-4">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-base font-bold text-foreground">Manage your subscription</h3>
                        <p className="text-sm text-gray-1000">
                            View invoices for past payments, update your billing details, or cancel your subscription.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <button
                            onClick={handleManageBilling}
                            disabled={isOpeningPortal}
                            className="flex h-8 items-center justify-center rounded-md border border-border bg-card px-2 text-xs text-gray-1100 shadow-sm hover:bg-secondary disabled:opacity-60"
                        >
                            {isOpeningPortal ? "Opening..." : "View invoices"}
                        </button>
                        <button
                            onClick={handleManageBilling}
                            disabled={isOpeningPortal}
                            className="flex h-8 items-center justify-center rounded-md border border-border bg-card px-2 text-xs text-gray-1100 shadow-sm hover:bg-secondary disabled:opacity-60"
                        >
                            {isOpeningPortal ? "Opening..." : "View billing portal"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
