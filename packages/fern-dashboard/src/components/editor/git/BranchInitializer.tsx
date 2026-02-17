"use client";

import { isValidBranchNameFormat } from "@fern-docs/components/navigation";
import { useEffect, useRef } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { useBranch } from "@/providers/BranchContext";
import { useCreateBranchMutation } from "@/state/useCreateBranchMutation";
import type { DocsUrl } from "@/utils/types";

interface BranchInitializerProps {
    orgName: Auth0OrgName;
    site: DocsUrl;
    owner: string;
    repo: string;
    branch: string;
    baseBranch: string;
    gitUrl?: string;
}

export function BranchInitializer({ orgName, site, owner, repo, branch, baseBranch, gitUrl }: BranchInitializerProps) {
    const createBranchMutation = useCreateBranchMutation();
    const { setBranchFailed, setBranchFailureReason } = useBranch();
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Only run once on mount - we intentionally don't include mutation and setter in deps
        // because they can change identity but we only want to run this once
        if (hasInitialized.current) {
            return;
        }
        hasInitialized.current = true;

        // Validate branch name format before initializing
        if (!isValidBranchNameFormat(branch)) {
            console.error("[BranchInitializer] Invalid branch name format:", branch);
            setBranchFailed(true);
            setBranchFailureReason("Editor disabled due to invalid branch name");
            return;
        }

        createBranchMutation
            .mutateAsync({
                orgName,
                site,
                owner,
                repo,
                branch,
                baseBranch,
                gitUrl
            })
            .then((result) => {
                if (!result.success) {
                    console.error("[BranchInitializer] Failed to create branch:", result.error);
                    setBranchFailed(true);
                    setBranchFailureReason(result.error.type);
                }
            })
            .catch((error) => {
                console.error("[BranchInitializer] Error during branch creation:", {
                    error,
                    orgName,
                    owner,
                    repo,
                    branch,
                    baseBranch
                });
                setBranchFailed(true);
                setBranchFailureReason("An unexpected error occurred while creating the branch.");
            });
    }, [
        orgName,
        site,
        owner,
        repo,
        branch,
        baseBranch,
        createBranchMutation,
        setBranchFailed,
        setBranchFailureReason,
        gitUrl
    ]);

    return null;
}
