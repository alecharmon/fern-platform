"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useMemo } from "react";

import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEntitlement } from "@/state/useEntitlement";
import { useCurrentOrganization } from "@/state/useOrganizations";

import { executeUpsellAction } from "./actions";
import { UPSELL_CONFIGS } from "./configs";
import { UPSELL_CONTENT } from "./content";
import { DEFAULT_CTA_LABELS, type UpsellAction } from "./types";
import { useUpsell } from "./UpsellProvider";
import { useCurrentTier } from "./useCurrentTier";

function getCtaLabel(action: UpsellAction | undefined): string {
    if (!action) {
        return "Upgrade to Team";
    }
    return action.ctaLabel ?? DEFAULT_CTA_LABELS[action.type];
}

export function UpsellModal() {
    const { activeFeature, isOpen, closeUpsell } = useUpsell();
    const posthog = usePostHog();
    const router = useRouter();
    const org = useCurrentOrganization();
    const tier = useCurrentTier();
    const { isEntitled: canPurchaseSeats } = useEntitlement("can_purchase_additional_seats");

    // For the seats feature, can_purchase_additional_seats is the source of truth
    // for which modal to show. This handles cases where billing data and entitlements
    // are out of sync — e.g. billing says "paid" but grants say free plan limits apply.
    const effectiveTier = activeFeature === "seats" && !canPurchaseSeats ? "free" : tier;

    const config = activeFeature ? UPSELL_CONFIGS[activeFeature] : null;
    const action: UpsellAction | undefined = config && effectiveTier ? config.actions[effectiveTier] : undefined;
    const ctaLabel = getCtaLabel(action);
    const CustomContent = activeFeature && effectiveTier ? UPSELL_CONTENT[activeFeature]?.[effectiveTier] : undefined;

    // Resolve tier-specific overrides
    const resolved = useMemo(() => {
        if (!config) {
            return null;
        }
        const overrides = effectiveTier ? config.tierOverrides?.[effectiveTier] : undefined;
        return {
            title: overrides?.title ?? config.title,
            description: overrides?.description ?? config.description,
            featureIntro: overrides && "featureIntro" in overrides ? overrides.featureIntro : config.featureIntro,
            features: overrides && "features" in overrides ? overrides.features : config.features,
            learnMoreUrl: overrides && "learnMoreUrl" in overrides ? overrides.learnMoreUrl : config.learnMoreUrl
        };
    }, [config, effectiveTier]);

    useEffect(() => {
        if (isOpen && activeFeature) {
            captureEvent(posthog, PosthogEventName.BILLING_LIMIT_HIT, {
                limitType: activeFeature
            });
        }
    }, [isOpen, activeFeature, posthog]);

    const handleAction = useCallback(() => {
        if (!action || !org?.name) {
            return;
        }
        captureEvent(posthog, PosthogEventName.UPGRADE_CTA_CLICKED, {
            source: "upsell_modal"
        });
        executeUpsellAction(action, { orgName: org.name, router });
        closeUpsell();
    }, [action, org?.name, posthog, router, closeUpsell]);

    const handleLearnMore = useCallback(() => {
        if (resolved?.learnMoreUrl) {
            window.open(resolved.learnMoreUrl, "_blank", "noopener,noreferrer");
        }
    }, [resolved?.learnMoreUrl]);

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                closeUpsell();
            }
        },
        [closeUpsell]
    );

    if (!config || !resolved) {
        return null;
    }

    const Icon = config.icon;
    const HeaderContent = config.headerContent;
    const hasFeatures = resolved.features && resolved.features.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="overflow-clip p-0 pb-6 md:max-w-[480px]">
                {/* Decorative header */}
                {HeaderContent ? (
                    <HeaderContent />
                ) : (
                    <div className="relative h-[120px] w-full overflow-hidden border-b border-[#e0e1e6] dark:border-[#2e2f35]">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-100/60 via-green-50/40 to-white dark:from-green-900/25 dark:via-green-950/15 dark:to-transparent" />
                        <div className="absolute -left-10 -top-10 h-[200px] w-[300px] rounded-full bg-green-200/30 blur-3xl dark:bg-green-700/20" />
                        <div className="absolute -right-10 top-0 h-[150px] w-[200px] rounded-full bg-green-100/40 blur-2xl dark:bg-green-800/20" />
                        <div className="absolute bottom-0 left-1/4 h-[100px] w-[250px] rounded-full bg-green-200/20 blur-3xl dark:bg-green-700/10" />
                        {/* Progressive fade to background at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-white via-white/80 to-transparent dark:from-background dark:via-background/80" />

                        {/* Centered icon card */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                            <div className="flex size-16 items-center justify-center rounded-xl border border-[#eff0f3] bg-white shadow-[0px_4px_20px_0px_rgba(30,46,90,0.1)] dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:shadow-[0px_4px_20px_0px_rgba(0,0,0,0.5)]">
                                <Icon className="size-8 text-[#1e1f24] dark:text-[#e8e9f0]" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className="flex flex-col gap-6 px-6 pt-6">
                    {/* Title + description */}
                    <div className="flex flex-col gap-2">
                        <h4 className="text-xl font-bold leading-[25px] text-[#1e1f24] dark:text-[#e8e9f0]">
                            {resolved.title}
                        </h4>
                        {resolved.description && (
                            <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                                {resolved.description}
                            </p>
                        )}
                    </div>

                    {/* Feature intro + feature list */}
                    {(resolved.featureIntro || hasFeatures) && (
                        <div className="flex flex-col gap-2">
                            {resolved.featureIntro && (
                                <div className="flex h-6 items-center">
                                    <span className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                                        {resolved.featureIntro}
                                    </span>
                                </div>
                            )}
                            {hasFeatures &&
                                resolved.features!.map((feature) => {
                                    const FeatureIcon = feature.icon;
                                    return (
                                        <div key={feature.text} className="flex items-center gap-2">
                                            <FeatureIcon className="size-5 shrink-0 text-[#80828d] dark:text-[#9a9ba6]" />
                                            <span className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                                                {feature.text}
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {/* Custom content slot — when present, it owns the footer buttons */}
                    {CustomContent && org?.id ? (
                        <CustomContent orgId={org.id} onClose={closeUpsell} onAction={handleAction} />
                    ) : (
                        /* Default footer buttons */
                        <div className="flex items-center justify-end gap-2">
                            {resolved.learnMoreUrl && (
                                <Button
                                    variant="outline"
                                    className="h-8 rounded-md border-[#e8e8eb] px-3 text-sm text-[#3d3e45] dark:border-[#3e3f46] dark:text-[#c5c7d0]"
                                    onClick={handleLearnMore}
                                >
                                    Learn more
                                </Button>
                            )}
                            <Button
                                className="h-8 rounded-md bg-[#008700] px-3 text-sm text-white hover:bg-[#007600] dark:bg-[#00a300] dark:hover:bg-[#008700]"
                                onClick={handleAction}
                            >
                                {ctaLabel}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
