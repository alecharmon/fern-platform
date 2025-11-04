import { createNavigationBufferedIndexedDBStorage, type NavigationSnapshot } from "@fern-docs/components/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useLocalBranches() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const [allBranches, setAllBranches] = useState<NavigationSnapshot[]>([]);

    const fetchAllBranches = useCallback(async () => {
        setLoading(true);
        setError(null);
        const storage = createNavigationBufferedIndexedDBStorage();
        await storage.init();
        const branches = storage.getAllStoredBranches();
        setAllBranches(branches);
        setLoading(false);
    }, []);

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
