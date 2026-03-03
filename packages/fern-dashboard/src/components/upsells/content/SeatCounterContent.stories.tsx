import type { Meta, StoryObj } from "@storybook/react";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import { fn } from "storybook/test";

import { Button } from "@/components/ui/button";

import { formatCentsAsDollars } from "./formatCentsAsDollars";

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
// Presentational wrapper — mirrors SeatCounterContent visuals without hooks
// ---------------------------------------------------------------------------

interface SeatCounterStoryProps {
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
    onConfirm: () => void;
    onCancel: () => void;
    onManagePayment: () => void;
}

function SeatCounterStory({
    usedMembers,
    currentMembers,
    count,
    isLoading,
    isPriceLoading,
    pricePreview,
    errorMessage,
    onConfirm,
    onCancel,
    onManagePayment
}: SeatCounterStoryProps) {
    const seatsDelta = count - currentMembers;
    const isAtLimit = usedMembers >= currentMembers && currentMembers > 0;
    const isAdding = seatsDelta > 0;
    const isRemoving = seatsDelta < 0;
    const absDelta = Math.abs(seatsDelta);
    const periodLabel = pricePreview?.billingInterval === "year" ? "yr" : "mo";

    return (
        <div className="flex w-[432px] flex-col gap-6">
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
                <span className="w-8 text-center text-sm font-medium text-[#1e1f24] dark:text-[#e8e9f0]">{count}</span>
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

            {/* Line items — shown when seat count changed */}
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
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <Button
                    className="h-8 rounded-[6px] bg-[#008700] px-3 text-sm text-white hover:bg-[#007600] disabled:opacity-50 dark:bg-[#00a300] dark:hover:bg-[#008700]"
                    disabled={seatsDelta === 0 || isLoading || isPriceLoading || count > MAX_PRO_TOTAL_SEATS}
                    onClick={onConfirm}
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
                            <p className="text-sm leading-4 text-[#6b7280] dark:text-[#9ca3af]">{errorMessage}</p>
                        </div>
                    </div>
                    <Button variant="dark" size="sm" onClick={onManagePayment}>
                        Manage payment method
                    </Button>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SeatCounterStory> = {
    title: "Upsells/SeatCounterContent",
    component: SeatCounterStory,
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
        usedMembers: 3,
        currentMembers: 5,
        count: 5,
        isLoading: false,
        isPriceLoading: false,
        pricePreview: null,
        errorMessage: null,
        onConfirm: fn(),
        onCancel: fn(),
        onManagePayment: fn()
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Buying seats stories
// ---------------------------------------------------------------------------

/** Default view when user is at their member limit and hasn't changed the counter yet. */
export const AtMemberLimit: Story = {
    name: "At member limit",
    args: {
        usedMembers: 5,
        currentMembers: 5,
        count: 5
    }
};

/** User has increased seat count — price preview loaded with monthly billing. */
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

/** User has increased seat count — price preview loaded with yearly billing. */
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

/** User has decreased seat count — shows negative change amount. */
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

/** Debounced price preview is still loading from Stripe. */
export const LoadingPrice: Story = {
    name: "Loading price preview",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        isPriceLoading: true
    }
};

/** Checkout is in progress — Confirm button shows "Adding..." and is disabled. */
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

/** User selected more seats than the pro plan allows — shows upgrade callout. */
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
export const CardDeclined: Story = {
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
export const CardExpired: Story = {
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
export const InsufficientFunds: Story = {
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
export const NoSubscription: Story = {
    name: "Error: no active subscription",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        errorMessage: "No active subscription found. Please contact support."
    }
};

/** Server could not find a Stripe customer for the org's billing account. */
export const NoStripeCustomer: Story = {
    name: "Error: no Stripe customer",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        errorMessage: "No Stripe customer found. Please contact support."
    }
};

/** Generic catch-all error from the server action. */
export const GenericError: Story = {
    name: "Error: generic failure",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        errorMessage: "Failed to update seats. Please try again."
    }
};

/** Stripe returned an error during the price preview fetch, not during checkout. */
export const PricePreviewError: Story = {
    name: "Error: price preview failed",
    args: {
        usedMembers: 3,
        currentMembers: 5,
        count: 7,
        errorMessage: "Failed to look up billing account"
    }
};
