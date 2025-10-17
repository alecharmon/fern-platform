"use client";

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
}

export function BranchInitializer({ orgName, site, owner, repo, branch, baseBranch }: BranchInitializerProps) {
    const createBranchMutation = useCreateBranchMutation();
    const { setBranchFailed } = useBranch();
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Only run once on mount - we intentionally don't include mutation and setter in deps
        // because they can change identity but we only want to run this once
        if (hasInitialized.current) {
            return;
        }
        hasInitialized.current = true;

        createBranchMutation
            .mutateAsync({
                orgName,
                site,
                owner,
                repo,
                branch,
                baseBranch
            })
            .then((result) => {
                if (!result.success) {
                    console.error("Failed to create branch:", result.error);
                    setBranchFailed(true);
                }
            })
            .catch((error) => {
                console.error("Error creating branch:", {
                    error,
                    orgName,
                    owner,
                    repo,
                    branch,
                    baseBranch
                });
                setBranchFailed(true);
            });
    }, [orgName, site, owner, repo, branch, baseBranch]);

    return null;
}
