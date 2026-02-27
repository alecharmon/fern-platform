import {
    type BranchMetadata,
    createNavigationBufferedIndexedDBStorage,
    type RemoteSnapshotSync
} from "@fern-docs/components/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useLocalBranches(options?: { remoteSync?: RemoteSnapshotSync; orgName?: string; docsUrl?: string }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const [allBranches, setAllBranches] = useState<BranchMetadata[]>([]);

    const remoteSync = options?.remoteSync;
    const orgName = options?.orgName;
    const docsUrl = options?.docsUrl;

    const fetchAllBranches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const storage = createNavigationBufferedIndexedDBStorage();
            await storage.init();
            const localBranches = await storage.getAllStoredBranchMetadata();

            if (remoteSync && orgName) {
                try {
                    const remoteResult = await remoteSync.listSnapshots({ orgId: orgName, docsUrl });
                    const remoteBranches: BranchMetadata[] = remoteResult.snapshots.map(
                        (s: {
                            branch: string;
                            docsUrl: string;
                            schemaVersion: number;
                            createdAt: string;
                            updatedAt: string;
                            prTitle?: string | null;
                            prUrl?: string | null;
                            orgName?: string | null;
                        }) => ({
                            branchName: s.branch,
                            metadata: {
                                orgName: s.orgName ?? orgName,
                                docsUrl: s.docsUrl,
                                prTitle: s.prTitle ?? undefined,
                                prUrl: s.prUrl ?? undefined
                            }
                        })
                    );
                    const localBranchSet = new Set(localBranches.map((b) => b.branchName));
                    const merged = [
                        ...localBranches,
                        ...remoteBranches.filter((b) => !localBranchSet.has(b.branchName))
                    ];
                    setAllBranches(merged);
                } catch {
                    setAllBranches(localBranches);
                }
            } else {
                setAllBranches(localBranches);
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to load branches"));
        } finally {
            setLoading(false);
        }
    }, [remoteSync, orgName, docsUrl]);

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

        if (remoteSync && orgName) {
            const branch = allBranches.find((b) => b.branchName === branchName);
            if (branch) {
                remoteSync
                    .deleteSnapshot({
                        orgId: orgName,
                        branch: branchName,
                        docsUrl: branch.metadata.docsUrl
                    })
                    .catch(() => {});
            }
        }

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
