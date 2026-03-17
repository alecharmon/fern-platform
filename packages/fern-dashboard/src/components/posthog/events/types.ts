/**
 * Phantom types for compile-time enforcement of required fields.
 * Used by event builders to ensure all required properties are set before build().
 */
type Unset = "unset";
type IsSet = "set";

export type { IsSet, Unset };

/**
 * Base properties shared by all server-side PostHog funnel events.
 * Every funnel event type must extend this interface.
 */
export interface BaseServerPosthogEventProperties {
    orgId: string;
    orgName?: string;
    userId: string;
}
