/**
 * Format a Stripe cents amount as a human-readable dollar string.
 */
export function formatCentsAsDollars(cents: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2
    }).format(cents / 100);
}
