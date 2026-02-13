import { useReducer } from "react";

import {
    type ChecklistItemId,
    isAllComplete as checkAllComplete,
    type DomainChecklistState,
    domainSetupReducer,
    getInitialChecklistState
} from "./domainSetupStateMachine";

interface UseDomainSetupStateParams {
    ownershipVerified: boolean;
    configPublished: boolean;
    dnsConfigured: boolean;
    prCreated: boolean;
}

interface UseDomainSetupStateReturn {
    state: DomainChecklistState;
    isAllComplete: boolean;
    expandItem: (item: ChecklistItemId) => void;
    collapseItem: () => void;
    handleOwnershipVerifying: () => void;
    handleOwnershipVerified: () => void;
    handleOwnershipFailed: () => void;
    handleConfigUpdated: () => void;
    handleDnsVerifying: () => void;
    handleDnsVerified: () => void;
    handleDnsFailed: () => void;
    handleProxyConfirming: () => void;
    handleProxyConfirmed: () => void;
    handleProxyFailed: () => void;
}

export function useDomainSetupState({
    ownershipVerified,
    configPublished,
    dnsConfigured,
    prCreated
}: UseDomainSetupStateParams): UseDomainSetupStateReturn {
    const [state, dispatch] = useReducer(
        domainSetupReducer,
        getInitialChecklistState({ ownershipVerified, configPublished, dnsConfigured, prCreated })
    );

    return {
        state,
        isAllComplete: checkAllComplete(state),
        expandItem: (item: ChecklistItemId) => dispatch({ type: "EXPAND_ITEM", item }),
        collapseItem: () => dispatch({ type: "COLLAPSE_ITEM" }),
        handleOwnershipVerifying: () => dispatch({ type: "OWNERSHIP_VERIFYING" }),
        handleOwnershipVerified: () => dispatch({ type: "OWNERSHIP_VERIFIED" }),
        handleOwnershipFailed: () => dispatch({ type: "OWNERSHIP_FAILED" }),
        handleConfigUpdated: () => dispatch({ type: "CONFIG_UPDATED" }),
        handleDnsVerifying: () => dispatch({ type: "DNS_VERIFYING" }),
        handleDnsVerified: () => dispatch({ type: "DNS_VERIFIED" }),
        handleDnsFailed: () => dispatch({ type: "DNS_FAILED" }),
        handleProxyConfirming: () => dispatch({ type: "PROXY_CONFIRMING" }),
        handleProxyConfirmed: () => dispatch({ type: "PROXY_CONFIRMED" }),
        handleProxyFailed: () => dispatch({ type: "PROXY_FAILED" })
    };
}
