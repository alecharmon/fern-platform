import { useMemo } from "react";
import type { DocsUrl } from "@/utils/types";
import { useLocalBranches } from "./useLocalBranches";

export function useLocalBranchesForSite(docsUrl: DocsUrl) {
    const { allBranches } = useLocalBranches();
    const filteredBranches = useMemo(
        () =>
            allBranches
                .filter((branch) => branch.metadata.docsUrl === docsUrl)
                .sort((a, b) => b.branchName.localeCompare(a.branchName)),
        [docsUrl, allBranches]
    );
    return { filteredBranches };
}
