import type { BillingCycle, Plan } from "./plans";

export type PlanCardStatus =
    | { status: "current" }
    | { status: "downgrade"; isDowngrading: boolean; onDowngrade: () => void }
    | { status: "upgradable"; isUpgrading: boolean; isNextTier: boolean; onUpgrade: (plan: Plan) => void };

export interface PlanCardProps {
    plan: Plan;
    cardStatus: PlanCardStatus;
    isOnFreePlan: boolean;
    hasTrialAvailable: boolean;
    billingCycle: BillingCycle;
    useSuperUserPricing: boolean;
}

function resolvePricing(plan: Plan, billingCycle: BillingCycle, useSuperUserPricing: boolean) {
    if (plan.pricing.type === "static") {
        return {
            displayPrice: plan.pricing.displayPrice,
            period: plan.pricing.period,
            subtitle: plan.pricing.subtitle
        };
    }

    if (useSuperUserPricing && plan.pricing.superUserPriceIds != null) {
        return { displayPrice: "$0", period: "/mo", subtitle: "" };
    }

    const cycle = plan.pricing.cycles[billingCycle];
    return { displayPrice: cycle.displayPrice, period: cycle.period, subtitle: cycle.subtitle };
}

function PlanCardButton({
    plan,
    cardStatus,
    hasTrialAvailable
}: {
    plan: Plan;
    cardStatus: PlanCardStatus;
    hasTrialAvailable: boolean;
}) {
    switch (cardStatus.status) {
        case "current":
            return (
                <button
                    disabled
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-gray-400 bg-card px-4 py-3 text-sm text-foreground shadow-sm"
                >
                    Current plan
                </button>
            );
        case "downgrade":
            return (
                <button
                    onClick={() => cardStatus.onDowngrade()}
                    disabled={cardStatus.isDowngrading}
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-gray-400 bg-card px-4 py-3 text-sm text-foreground shadow-sm hover:bg-secondary disabled:opacity-60"
                >
                    {cardStatus.isDowngrading ? "Opening..." : "Downgrade"}
                </button>
            );
        case "upgradable":
            return (
                <button
                    onClick={() => cardStatus.onUpgrade(plan)}
                    disabled={cardStatus.isUpgrading}
                    className={
                        cardStatus.isNextTier
                            ? "flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
                            : "flex h-10 w-full items-center justify-center rounded-lg border border-gray-400 bg-card px-4 py-3 text-sm text-foreground shadow-sm hover:bg-secondary disabled:opacity-60"
                    }
                >
                    {cardStatus.isUpgrading
                        ? "Loading..."
                        : hasTrialAvailable && plan.trialButtonText
                          ? plan.trialButtonText
                          : plan.buttonText}
                </button>
            );
    }
}

export function PlanCard({
    plan,
    cardStatus,
    isOnFreePlan,
    hasTrialAvailable,
    billingCycle,
    useSuperUserPricing
}: PlanCardProps) {
    const isHighlighted = plan.tier === "paid";
    const { displayPrice, period, subtitle } = resolvePricing(plan, billingCycle, useSuperUserPricing);

    return (
        <div
            className={`relative grid grid-rows-subgrid row-span-5 gap-4 overflow-hidden rounded-2xl p-4 ${
                isHighlighted && isOnFreePlan ? "border-2 border-transparent" : "border border-gray-600"
            }`}
        >
            {/* Background */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl bg-card" />
            {/* Gradient border for highlighted non-active plan */}
            {isHighlighted && isOnFreePlan && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-10 rounded-2xl [--gradient-from:#a7bff7] [--gradient-to:#34d399] dark:[--gradient-from:#4a6bb8] dark:[--gradient-to:#156344]"
                    style={{
                        padding: "2px",
                        background: "linear-gradient(to bottom, var(--gradient-from), var(--gradient-to))",
                        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                        maskComposite: "exclude"
                    }}
                />
            )}

            {/* Plan name */}
            <h3 className="relative z-10 text-base font-bold text-foreground">{plan.name}</h3>

            {/* Pricing */}
            <div className="relative z-10 flex flex-col gap-1">
                <p className="text-xl font-bold text-foreground">
                    {displayPrice}
                    {period && <span className="text-base font-bold">{period}</span>}
                </p>
                {subtitle && <p className="text-sm text-gray-1000">{subtitle}</p>}
            </div>

            {/* Description */}
            <p className="relative z-10 self-end text-sm text-gray-1100">{plan.description}</p>

            {/* CTA Button */}
            <div className="relative z-10">
                <PlanCardButton plan={plan} cardStatus={cardStatus} hasTrialAvailable={hasTrialAvailable} />
            </div>

            {/* Features */}
            <div className="relative z-10 flex flex-col gap-2">
                {plan.featureHeader && <span className="text-sm text-gray-1000">{plan.featureHeader}</span>}
                {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <feature.icon className="size-5 shrink-0 text-gray-1000" />
                        <span className="text-sm text-gray-1000">{feature.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
