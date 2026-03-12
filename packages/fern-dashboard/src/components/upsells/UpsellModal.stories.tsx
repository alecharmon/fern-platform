import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { fn } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { UPSELL_CONFIGS } from "./configs";
import { DEFAULT_CTA_LABELS, type UpsellAction, type UpsellConfig, type UpsellFeature } from "./types";

// ---------------------------------------------------------------------------
// Pylon mock — installs a spy on window.Pylon so pylon actions are visible
// in the Storybook actions panel.
// ---------------------------------------------------------------------------

const pylonSpy = fn().mockName("Pylon");

function PylonMockDecorator(Story: React.ComponentType) {
    useEffect(() => {
        (window as any).Pylon = pylonSpy;
        return () => {
            delete (window as any).Pylon;
        };
    }, []);
    return <Story />;
}

// ---------------------------------------------------------------------------
// Presentational wrapper that renders the modal visuals without providers
// ---------------------------------------------------------------------------

interface UpsellModalStoryProps {
    feature: UpsellFeature;
    tier: "free" | "paid" | "enterprise";
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAction: () => void;
    onLearnMore: () => void;
}

function getCtaLabel(action: UpsellAction | undefined): string {
    if (!action) {
        return "Upgrade to Team";
    }
    return action.ctaLabel ?? DEFAULT_CTA_LABELS[action.type];
}

function resolveConfig(config: UpsellConfig, tier: "free" | "paid" | "enterprise") {
    const overrides = config.tierOverrides?.[tier];
    return {
        title: overrides?.title ?? config.title,
        description: overrides?.description ?? config.description,
        featureIntro: overrides && "featureIntro" in overrides ? overrides.featureIntro : config.featureIntro,
        features: overrides && "features" in overrides ? overrides.features : config.features,
        learnMoreUrl: overrides && "learnMoreUrl" in overrides ? overrides.learnMoreUrl : config.learnMoreUrl
    };
}

/** Standalone visual representation of the UpsellModal for Storybook. */
function UpsellModalStory({ feature, tier, open, onOpenChange, onAction, onLearnMore }: UpsellModalStoryProps) {
    const config = UPSELL_CONFIGS[feature];
    const action: UpsellAction | undefined = config.actions[tier];
    const ctaLabel = getCtaLabel(action);
    const resolved = resolveConfig(config, tier);

    const Icon = config.icon;
    const HeaderContent = config.headerContent;
    const hasFeatures = resolved.features && resolved.features.length > 0;

    const handleAction = () => {
        // For pylon actions, call the mock Pylon so it shows in the actions panel
        if (action?.type === "pylon") {
            const pylon = (window as any).Pylon;
            if (pylon) {
                if (action.message) {
                    pylon("showNewMessage", action.message);
                } else {
                    pylon("show");
                }
                pylon("showChatBubble");
            }
        }
        onAction();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                        <div className="dark:from-background dark:via-background/80 absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-white via-white/80 to-transparent" />

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
                                resolved.features!.map((f) => {
                                    const FeatureIcon = f.icon;
                                    return (
                                        <div key={f.text} className="flex items-center gap-2">
                                            <FeatureIcon className="size-5 shrink-0 text-[#80828d] dark:text-[#9a9ba6]" />
                                            <span className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                                                {f.text}
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {/* Footer buttons */}
                    <div className="flex items-center justify-end gap-2">
                        {resolved.learnMoreUrl && (
                            <Button
                                variant="outline"
                                className="h-8 rounded-md border-[#e8e8eb] px-3 text-sm text-[#3d3e45] dark:border-[#3e3f46] dark:text-[#c5c7d0]"
                                onClick={onLearnMore}
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
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof UpsellModalStory> = {
    title: "Upsells/UpsellModal",
    component: UpsellModalStory,
    decorators: [PylonMockDecorator],
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        feature: {
            control: { type: "select" },
            options: [
                "seats",
                "ai_credits",
                "custom_domain_subpath",
                "docs_sites",
                "custom_domains",
                "pdf_export",
                "password_protection"
            ] satisfies UpsellFeature[]
        },
        tier: {
            control: { type: "select" },
            options: ["free", "paid", "enterprise"]
        },
        open: { control: { type: "boolean" } }
    },
    args: {
        open: true,
        onOpenChange: fn(),
        onAction: fn(),
        onLearnMore: fn()
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories — one per feature, defaults to the "free" tier view
// ---------------------------------------------------------------------------

export const Seats: Story = {
    args: { feature: "seats", tier: "free" }
};

export const SeatsPaid: Story = {
    name: "Seats (paid tier)",
    args: { feature: "seats", tier: "paid" }
};

export const SeatsEnterprise: Story = {
    name: "Seats (enterprise tier)",
    args: { feature: "seats", tier: "enterprise" }
};

export const AiCredits: Story = {
    name: "AI credits",
    args: { feature: "ai_credits", tier: "free" }
};

export const AiCreditsPaid: Story = {
    name: "AI credits (paid tier)",
    args: { feature: "ai_credits", tier: "paid" }
};

export const CustomDomainSubpath: Story = {
    name: "Custom domain subpath",
    args: { feature: "custom_domain_subpath", tier: "free" }
};

export const DocsSites: Story = {
    name: "Docs sites",
    args: { feature: "docs_sites", tier: "free" }
};

export const CustomDomains: Story = {
    name: "Custom domains",
    args: { feature: "custom_domains", tier: "free" }
};

export const CustomDomainsPaid: Story = {
    name: "Custom domains (paid tier)",
    args: { feature: "custom_domains", tier: "paid" }
};

export const PdfExport: Story = {
    name: "PDF export",
    args: { feature: "pdf_export", tier: "free" }
};

export const PasswordProtection: Story = {
    name: "Password protection",
    args: { feature: "password_protection", tier: "free" }
};
