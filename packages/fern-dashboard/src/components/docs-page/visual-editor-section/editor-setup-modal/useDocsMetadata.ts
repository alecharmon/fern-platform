import { useQuery } from "@tanstack/react-query";
import { getDocsGithubMetadata } from "@/app/actions/getDocsGithubMetadata";
import type { DocsUrl } from "@/utils/types";

interface UseGithubMetadataParams {
    docsUrl: DocsUrl;
    enabled?: boolean;
    githubUrl?: string;
}

interface UseGithubMetadataReturn {
    githubUrl: string | undefined;
    loading: boolean;
}

/**
 * Custom hook to fetch and manage GitHub metadata for the docs URL.
 * Handles repo connection status and GitHub app installation checks.
 */
export function useDocsMetadata({ docsUrl, enabled = true }: UseGithubMetadataParams): UseGithubMetadataReturn {
    // Fetch GitHub metadata when modal is opened
    const { data: githubMetadataResult, isLoading } = useQuery({
        queryKey: ["github-metadata", docsUrl],
        queryFn: () => getDocsGithubMetadata(docsUrl),
        enabled,
        staleTime: 0,
        retry: false,
        // Keep previous data while refetching to prevent UI flicker
        placeholderData: (previousData) => previousData
    });

    return {
        githubUrl: githubMetadataResult?.success ? githubMetadataResult.githubUrl : undefined,
        loading: isLoading
    };
}
