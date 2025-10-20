"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

export const BranchContext = createContext<{
    branch: string;
    setBranch: (branch: string) => void;
    branchFailed: boolean;
    setBranchFailed: (failed: boolean) => void;
    branchFailureReason: string | undefined;
    setBranchFailureReason: (reason: string | undefined) => void;
}>({
    branch: "",
    setBranch: (_branch: string) => {
        return;
    },
    branchFailed: false,
    setBranchFailed: (_failed: boolean) => {
        return;
    },
    branchFailureReason: undefined,
    setBranchFailureReason: (_reason: string | undefined) => {
        return;
    }
});

export function BranchProvider({ branch, children }: { branch: string; children: ReactNode }) {
    const [currBranch, setBranchStore] = useState<string>(branch);
    const [branchFailed, setBranchFailed] = useState<boolean>(false);
    const [branchFailureReason, setBranchFailureReason] = useState<string | undefined>(undefined);

    function setBranch(branch: string) {
        setBranchStore(branch);
    }

    return (
        <BranchContext.Provider
            value={{
                branch: currBranch,
                setBranch,
                branchFailed,
                setBranchFailed,
                branchFailureReason,
                setBranchFailureReason
            }}
        >
            {children}
        </BranchContext.Provider>
    );
}

export function useBranch() {
    return useContext(BranchContext);
}
