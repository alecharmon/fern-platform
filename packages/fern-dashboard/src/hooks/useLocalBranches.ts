import { type BranchMetadata, createNavigationBufferedIndexedDBStorage } from "@fern-docs/components/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useLocalBranches() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const [allBranches, setAllBranches] = useState<BranchMetadata[]>([]);

    const fetchAllBranches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const storage = createNavigationBufferedIndexedDBStorage();
            await storage.init();
            // Use memory-efficient metadata API instead of loading full snapshots
            const branches = await storage.getAllStoredBranchMetadata();
            setAllBranches(branches);
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to load branches"));
        } finally {
            setLoading(false);
        }
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run on mount
    useEffect(() => {
        void fetchAllBranches();
    }, []);

    const userHasCreatedAnyBranch = useMemo(() => {
        return allBranches.length > 0;
    }, [allBranches]);

    const refetch = async () => {
        void fetchAllBranches();
    };

    const deleteBranch = async (branchName: string) => {
        const storage = createNavigationBufferedIndexedDBStorage();
        await storage.init();
        storage.removeStore(branchName);
        setAllBranches(allBranches.filter((branch) => branch.branchName !== branchName));
    };

    return {
        allBranches,
        loading,
        error,
        refetch,
        deleteBranch,
        userHasCreatedAnyBranch
    };
}
