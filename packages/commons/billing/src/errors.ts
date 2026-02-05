/**
 * Billing error codes for operations.
 */
export const BILLING_ERROR_CODES = [
    "NOT_CONFIGURED",
    "NOT_FOUND",
    "QUERY_FAILED",
    "STRIPE_ERROR",
    "INVALID_STATE"
] as const;

export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[number];

/**
 * Billing-specific error type.
 */
export interface BillingError {
    source: "billing";
    code: BillingErrorCode;
    message: string;
    cause?: unknown;
}

/**
 * Factory function to create a BillingError.
 */
export function billingError(code: BillingErrorCode, message: string, cause?: unknown): BillingError {
    return { source: "billing", code, message, cause };
}

/**
 * Type guard for BillingError.
 */
export function isBillingError(error: unknown): error is BillingError {
    return typeof error === "object" && error !== null && "source" in error && error.source === "billing";
}
