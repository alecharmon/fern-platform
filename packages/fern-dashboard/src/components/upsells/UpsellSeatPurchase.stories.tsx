import type { Meta, StoryObj } from "@storybook/react";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import { fn } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { UPSELL_CONFIGS } from "./configs";
import { formatCentsAsDollars } from "./content/formatCentsAsDollars";

/** Matches MAX_PRO_TOTAL_SEATS from @fern-platform/billing */
const MAX_PRO_TOTAL_SEATS = 10;

// ---------------------------------------------------------------------------
// Inline the preview shape to avoid importing server-only action module
// ---------------------------------------------------------------------------

interface PricePreview {
    perSeatCost: number;
    billingInterval: "month" | "year";
    currency: string;
    currentRecurringSubtotal: number;
    seatDeltaSubtotal: number;
    taxDelta: number;
    newRecurringTotal: number;
}

// ---------------------------------------------------------------------------
// Combined modal + seat counter content — shows the full paid-tier seats
// purchase experience including price preview and Stripe error states.
// ---------------------------------------------------------------------------

interface SeatPurchaseModalStoryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCancel: () => void;
    onManagePayment: () => void;
    /** Number of members currently using seats */
    usedMembers: number;
    /** Current plan seat limit */
    currentMembers: number;
    /** Selected seat count (adjusted via +/- buttons) */
    count: number;
    /** Whether a checkout is in progress */
    isLoading: boolean;
    /** Whether a price preview is being fetched */
    isPriceLoading: boolean;
    /** Resolved price preview from Stripe */
    pricePreview: PricePreview | null;
    /** Error message from Stripe or server */
    errorMessage: string | null;
}

function SeatPurchaseModalStory({
    open,
    onOpenChange,
    onCancel,
    onManagePayment,
    usedMembers,
    currentMembers,
    count,
    isLoading,
    isPriceLoading,
    pricePreview,
    errorMessage
}: SeatPurchaseModalStoryProps) {
    const config = UPSELL_CONFIGS.seats;
    const overrides = config.tierOverrides?.paid;
    const title = overrides?.title ?? config.title;
    const Icon = config.icon;

    const seatsDelta = count - currentMembers;
    const isAtLimit = usedMembers >= currentMembers && currentMembers > 0;
    const isAdding = seatsDelta > 0;
    const isRemoving = seatsDelta < 0;
    const absDelta = Math.abs(seatsDelta);
    const periodLabel = pricePreview?.billingInterval === "year" ? "yr" : "mo";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-clip p-0 pb-6 md:max-w-[480px]">
                {/* Decorative header */}
                <div className="relative h-[120px] w-full overflow-hidden border-b border-[#e0e1e6] dark:border-[#2e2f35]">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-100/60 via-green-50/40 to-white dark:from-green-900/25 dark:via-green-950/15 dark:to-transparent" />
                    <div className="absolute -left-10 -top-10 h-[200px] w-[300px] rounded-full bg-green-200/30 blur-3xl dark:bg-green-700/20" />
                    <div className="absolute -right-10 top-0 h-[150px] w-[200px] rounded-full bg-green-100/40 blur-2xl dark:bg-green-800/20" />
                    <div className="absolute bottom-0 left-1/4 h-[100px] w-[250px] rounded-full bg-green-200/20 blur-3xl dark:bg-green-700/10" />
                    <div className="dark:from-background dark:via-background/80 absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-white via-white/80 to-transparent" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="flex size-16 items-center justify-center rounded-xl border border-[#eff0f3] bg-white shadow-[0px_4px_20px_0px_rgba(30,46,90,0.1)] dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:shadow-[0px_4px_20px_0px_rgba(0,0,0,0.5)]">
                            <Icon className="size-8 text-[#1e1f24] dark:text-[#e8e9f0]" />
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-col gap-6 px-6 pt-6">
                    {/* Title */}
                    <h4 className="text-xl font-bold leading-[25px] text-[#1e1f24] dark:text-[#e8e9f0]">{title}</h4>

                    {/* Seat counter content */}
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
                                disabled={count <= usedMembers || isLoading}
                                className="flex size-8 items-center justify-center rounded-[6px] border border-[#e0e1e6] bg-white text-[#1e1f24] shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:text-[#e8e9f0] dark:hover:bg-[#2a2b31]"
                            >
                                <Minus className="size-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium text-[#1e1f24] dark:text-[#e8e9f0]">
                                {count}
                            </span>
                            <button
                                disabled={count > MAX_PRO_TOTAL_SEATS || isLoading}
                                className="flex size-8 items-center justify-center rounded-[6px] border border-[#e0e1e6] bg-white text-[#1e1f24] shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-[#2e2f35] dark:bg-[#1e1f24] dark:text-[#e8e9f0] dark:hover:bg-[#2a2b31]"
                            >
                                <Plus className="size-4" />
                            </button>
                            <span className="text-sm text-[#80828d] dark:text-[#9a9ba6]">members</span>
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
                                <Button variant="dark" size="sm">
                                    Contact us to upgrade
                                </Button>
                            </div>
                        )}

                        {/* Price line items */}
                        {seatsDelta !== 0 && (
                            <>
                                {isPriceLoading || !pricePreview ? (
                                    <p className="text-sm leading-4 text-[#80828d] dark:text-[#9a9ba6]">
                                        {isPriceLoading ? "Calculating\u2026" : ""}
                                    </p>
                                ) : (
                                    <>
                                        <div className="h-px bg-[#e0e1e6] dark:bg-[#2e2f35]" />
                                        <div className="flex items-center justify-between text-sm text-[#008700] dark:text-[#00a300]">
                                            <span>Members</span>
                                            <span className="font-mono">
                                                {absDelta} *{" "}
                                                {formatCentsAsDollars(pricePreview.perSeatCost, pricePreview.currency)}
                                                /member/{periodLabel}
                                            </span>
                                        </div>
                                        <div className="h-px bg-[#e0e1e6] dark:bg-[#2e2f35]" />
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
                                onClick={onCancel}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="h-8 rounded-[6px] bg-[#008700] px-3 text-sm text-white hover:bg-[#007600] disabled:opacity-50 dark:bg-[#00a300] dark:hover:bg-[#008700]"
                                disabled={
                                    seatsDelta === 0 || isLoading || isPriceLoading || count > MAX_PRO_TOTAL_SEATS
                                }
                            >
                                {isLoading ? (isRemoving ? "Removing\u2026" : "Adding\u2026") : "Confirm"}
                            </Button>
                        </div>

                        {/* Payment error callout */}
                        {errorMessage != null && (
                            <div className="flex flex-col items-end gap-3 rounded-xl border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] p-4 dark:border-[rgba(220,38,38,0.4)] dark:bg-[rgba(220,38,38,0.15)]">
                                <div className="flex w-full items-start gap-3">
                                    <AlertTriangle className="size-6 shrink-0 text-[#dc2626]" />
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <p className="text-sm leading-4 text-[#dc2626]">Oops! Payment failed.</p>
                                        <p className="text-sm leading-4 text-[#6b7280] dark:text-[#9ca3af]">
                                            {errorMessage}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="dark" size="sm" onClick={onManagePayment}>
                                    Manage payment method
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SeatPurchaseModalStory> = {
    title: "Upsells/UpsellModal/Seat Purchase",
    component: SeatPurchaseModalStory,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        usedMembers: { control: { type: "number" } },
        currentMembers: { control: { type: "number" } },
        count: { control: { type: "number" } },
        isLoading: { control: { type: "boolean" } },
        isPriceLoading: { control: { type: "boolean" } },
        errorMessage: { control: { type: "text" } }
    },
    args: {
        open: true,
        onOpenChange: fn(),
        onCancel: fn(),
        onManagePayment: fn(),
        usedMembers: 3,
        currentMembers: 5,
        count: 5,
        isLoading: false,
        isPriceLoading: false,
        pricePreview: null,
        errorMessage: null
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Buying seats stories
// ---------------------------------------------------------------------------

/** Modal at member limit — user sees "Manage amount of members" with counter at limit. */
export const AtMemberLimit: Story = {
    name: "At member limit",
    args: {
        usedMembers: 5,
        currentMembers: 5,
        count: 5
    }
};

/** Modal with seats added and monthly price preview loaded. */
export const AddingSeatsMonthly: Story = {
    name: "Adding seats (monthly)",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        pricePreview: {
            perSeatCost: 2500,
            billingInterval: "month",
            currency: "usd",
            currentRecurringSubtotal: 12500,
            seatDeltaSubtotal: 5000,
            taxDelta: 0,
            newRecurringTotal: 17500
        }
    }
};

/** Modal with seats added and yearly price preview loaded. */
export const AddingSeatsYearly: Story = {
    name: "Adding seats (yearly)",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 8,
        pricePreview: {
            perSeatCost: 24000,
            billingInterval: "year",
            currency: "usd",
            currentRecurringSubtotal: 120000,
            seatDeltaSubtotal: 72000,
            taxDelta: 0,
            newRecurringTotal: 192000
        }
    }
};

/** Modal with seats removed — shows negative change amount. */
export const RemovingSeats: Story = {
    name: "Removing seats",
    args: {
        usedMembers: 3,
        currentMembers: 8,
        count: 5,
        pricePreview: {
            perSeatCost: 2500,
            billingInterval: "month",
            currency: "usd",
            currentRecurringSubtotal: 20000,
            seatDeltaSubtotal: -7500,
            taxDelta: 0,
            newRecurringTotal: 12500
        }
    }
};

/** Debounced price preview is loading from Stripe. */
export const LoadingPrice: Story = {
    name: "Loading price preview",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        isPriceLoading: true
    }
};

/** Checkout in progress — Confirm button shows "Adding…" and is disabled. */
export const ProcessingCheckout: Story = {
    name: "Processing checkout",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        isLoading: true,
        pricePreview: {
            perSeatCost: 2500,
            billingInterval: "month",
            currency: "usd",
            currentRecurringSubtotal: 12500,
            seatDeltaSubtotal: 5000,
            taxDelta: 0,
            newRecurringTotal: 17500
        }
    }
};

/** User exceeded the max pro seat limit — shows upgrade callout with contact buttons. */
export const ExceededProSeatLimit: Story = {
    name: "Exceeded pro seat limit",
    args: {
        usedMembers: 5,
        currentMembers: 5,
        count: MAX_PRO_TOTAL_SEATS + 1
    }
};

// ---------------------------------------------------------------------------
// Stripe error stories
// ---------------------------------------------------------------------------

/** Stripe returned a card_declined error during checkout. */
export const StripeCardDeclined: Story = {
    name: "Stripe: card declined",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        pricePreview: {
            perSeatCost: 2500,
            billingInterval: "month",
            currency: "usd",
            currentRecurringSubtotal: 12500,
            seatDeltaSubtotal: 5000,
            taxDelta: 0,
            newRecurringTotal: 17500
        },
        errorMessage: "Your card was declined. Please try a different payment method."
    }
};

/** Stripe returned an expired_card error during checkout. */
export const StripeCardExpired: Story = {
    name: "Stripe: card expired",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        pricePreview: {
            perSeatCost: 2500,
            billingInterval: "month",
            currency: "usd",
            currentRecurringSubtotal: 12500,
            seatDeltaSubtotal: 5000,
            taxDelta: 0,
            newRecurringTotal: 17500
        },
        errorMessage: "Your card has expired. Update your payment method to continue."
    }
};

/** Stripe returned an insufficient_funds error during checkout. */
export const StripeInsufficientFunds: Story = {
    name: "Stripe: insufficient funds",
    args: {
        usedMembers: 5,
        currentMembers: 5,
        count: 8,
        pricePreview: {
            perSeatCost: 2500,
            billingInterval: "month",
            currency: "usd",
            currentRecurringSubtotal: 12500,
            seatDeltaSubtotal: 7500,
            taxDelta: 0,
            newRecurringTotal: 20000
        },
        errorMessage: "Your card has insufficient funds."
    }
};

/** Server could not find an active Stripe subscription for the org. */
export const ErrorNoSubscription: Story = {
    name: "Error: no active subscription",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        errorMessage: "No active subscription found. Please contact support."
    }
};

/** Server could not find a Stripe customer for the org's billing account. */
export const ErrorNoStripeCustomer: Story = {
    name: "Error: no Stripe customer",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        errorMessage: "No Stripe customer found. Please contact support."
    }
};

/** Generic catch-all error from the server action. */
export const ErrorGenericFailure: Story = {
    name: "Error: generic failure",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        errorMessage: "Failed to update seats. Please try again."
    }
};

/** Stripe returned an error during the price preview fetch (not during checkout). */
export const ErrorPricePreviewFailed: Story = {
    name: "Error: price preview failed",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        errorMessage: "Failed to load price preview"
    }
};
