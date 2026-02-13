/**
 * State machine for the Custom Domain Setup Checklist
 *
 * Checklist items and dependencies:
 * 1. Verify domain ownership (TXT record) — no prerequisites, unlocked by default
 * 2. Update docs.yml configuration (PR/manual) — no prerequisites, unlocked by default
 * 3. Configure DNS records OR Configure reverse proxy — requires #1 complete (locked until then)
 *
 * Items 1 and 2 can be done in parallel.
 * Item 3 unlocks after item 1 because Vercel DNS records are only available after TXT verification.
 * All three must be complete for the overall "Done" state.
 */

export type ChecklistItemId = "ownership" | "config" | "dns-or-proxy";

export type ChecklistItemStatus = "locked" | "not-started" | "in-progress" | "waiting" | "complete" | "failed";

export interface DomainChecklistState {
    ownership: ChecklistItemStatus;
    config: ChecklistItemStatus;
    dnsOrProxy: ChecklistItemStatus;
    expandedItem: ChecklistItemId | null;
}

export type DomainSetupEvent =
    | { type: "EXPAND_ITEM"; item: ChecklistItemId }
    | { type: "COLLAPSE_ITEM" }
    | { type: "OWNERSHIP_VERIFYING" }
    | { type: "OWNERSHIP_VERIFIED" }
    | { type: "OWNERSHIP_FAILED" }
    | { type: "CONFIG_UPDATED" }
    | { type: "DNS_VERIFYING" }
    | { type: "DNS_VERIFIED" }
    | { type: "DNS_FAILED" }
    | { type: "PROXY_CONFIRMING" }
    | { type: "PROXY_CONFIRMED" }
    | { type: "PROXY_FAILED" };

export function domainSetupReducer(state: DomainChecklistState, event: DomainSetupEvent): DomainChecklistState {
    switch (event.type) {
        case "EXPAND_ITEM": {
            // Can't expand locked items
            if (event.item === "dns-or-proxy" && state.dnsOrProxy === "locked") {
                return state;
            }
            return { ...state, expandedItem: state.expandedItem === event.item ? null : event.item };
        }

        case "COLLAPSE_ITEM":
            return { ...state, expandedItem: null };

        case "OWNERSHIP_VERIFYING":
            return { ...state, ownership: "in-progress" };

        case "OWNERSHIP_VERIFIED": {
            const dnsOrProxy = state.dnsOrProxy === "locked" ? "not-started" : state.dnsOrProxy;
            return {
                ...state,
                ownership: "complete",
                dnsOrProxy,
                // Auto-expand DNS/proxy if it was just unlocked
                expandedItem: state.dnsOrProxy === "locked" ? "dns-or-proxy" : state.expandedItem
            };
        }

        case "OWNERSHIP_FAILED":
            return { ...state, ownership: "failed" };

        case "CONFIG_UPDATED":
            return { ...state, config: "complete" };

        case "DNS_VERIFYING":
            return { ...state, dnsOrProxy: "in-progress" };

        case "DNS_VERIFIED":
            return { ...state, dnsOrProxy: "complete" };

        case "DNS_FAILED":
            return { ...state, dnsOrProxy: "failed" };

        case "PROXY_CONFIRMING":
            return { ...state, dnsOrProxy: "in-progress" };

        case "PROXY_CONFIRMED":
            return { ...state, dnsOrProxy: "complete" };

        case "PROXY_FAILED":
            return { ...state, dnsOrProxy: "failed" };

        default:
            return state;
    }
}

/**
 * Maps DB columns to checklist state for resuming partially-completed setups.
 *
 * Config status: complete if published, in-progress if PR created, not-started otherwise.
 *
 * | ownershipVerified | configPublished | prCreated | dnsConfigured | Ownership   | Config      | DNS/Proxy   |
 * |-------------------|-----------------|-----------|---------------|-------------|-------------|-------------|
 * | false             | false           | false     | false         | not-started | not-started | locked      |
 * | false             | false           | true      | false         | not-started | waiting     | locked      |
 * | true              | false           | false     | false         | complete    | not-started | not-started |
 * | true              | false           | true      | false         | complete    | waiting     | not-started |
 * | true              | true            | *         | true          | complete    | complete    | complete    |
 */
export function getInitialChecklistState({
    ownershipVerified,
    configPublished,
    dnsConfigured,
    prCreated
}: {
    ownershipVerified: boolean;
    configPublished: boolean;
    dnsConfigured: boolean;
    prCreated: boolean;
}): DomainChecklistState {
    const configStatus: ChecklistItemStatus = configPublished ? "complete" : prCreated ? "waiting" : "not-started";

    if (ownershipVerified && dnsConfigured) {
        return {
            ownership: "complete",
            config: configStatus,
            dnsOrProxy: "complete",
            expandedItem: configPublished ? null : "config"
        };
    }

    if (ownershipVerified) {
        return {
            ownership: "complete",
            config: configStatus,
            dnsOrProxy: "not-started",
            expandedItem: configPublished ? "dns-or-proxy" : "config"
        };
    }

    // Default: ownership not yet verified
    return {
        ownership: "not-started",
        config: configStatus,
        dnsOrProxy: "locked",
        expandedItem: "ownership"
    };
}

export function isAllComplete(state: DomainChecklistState): boolean {
    return state.ownership === "complete" && state.config === "complete" && state.dnsOrProxy === "complete";
}
