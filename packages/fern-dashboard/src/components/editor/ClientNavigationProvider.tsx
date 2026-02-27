"use client";

import type { ApiSourceType } from "@fern-api/docs-loader";
import {
    type DeletionToastCallback,
    NavigationStoreProvider,
    PreviewNavigationStoreProvider
} from "@fern-docs/components/navigation";

import { DescriptionEditModal } from "@/components/editor/DescriptionEditModal";
import { PageDeletedUndoToast } from "@/components/editor/EditorToasts";
import { useRemoteSnapshotSync } from "@/hooks/useRemoteSnapshotSync";
import { OpenApiSpecsProvider } from "@/providers/OpenApiSpecsContext";

export interface ClientNavigationProviderProps {
    children: React.ReactNode;
    branchName: string;
    orgName: string;
    docsUrl: string;
    /**
     * Array of [filePath, content] entries for docs.yml and referenced files.
     * NOTE: Passed as array from server components since Map cannot be serialized
     * by React Server Components. Converted to Map internally.
     */
    latestDocsYmlAndReferences: [string, string][] | null;
    fernFolderPath?: string;
    /**
     * Array of [filePath, content] entries for OpenAPI specs.
     * NOTE: Passed as array from server components since Map cannot be serialized
     * by React Server Components. Converted to Map internally.
     */
    openApiSpecs?: [string, string][] | null;
    apiSourceType?: ApiSourceType | null;
    /**
     * Array of file paths that are override files (for edit priority).
     * NOTE: Passed as array from server components since Set cannot be serialized
     * by React Server Components. Converted to Set internally.
     */
    openApiOverrideFilePaths?: string[];
    /** Path to generators.yml (for updating when creating new override files) */
    generatorsYmlPath?: string;
    /** Content of generators.yml (for updating when creating new override files) */
    generatorsYmlContent?: string;
}

export function ClientNavigationProvider(props: ClientNavigationProviderProps) {
    const deletionToastCallback: DeletionToastCallback = (pageTitle: string, onUndo: () => void) => {
        PageDeletedUndoToast(pageTitle, onUndo);
    };
    const remoteSync = useRemoteSnapshotSync(props.orgName);

    return (
        <NavigationStoreProvider
            branchName={props.branchName}
            orgName={props.orgName}
            docsUrl={props.docsUrl}
            latestDocsYmlAndReferences={
                props.latestDocsYmlAndReferences ? new Map(props.latestDocsYmlAndReferences) : null
            }
            fernFolderPath={props.fernFolderPath}
            deletionToastCallback={deletionToastCallback}
            remoteSync={remoteSync}
        >
            <OpenApiSpecsProvider
                specs={props.openApiSpecs ? new Map(props.openApiSpecs) : null}
                sourceType={props.apiSourceType ?? null}
                overrideFilePaths={props.openApiOverrideFilePaths ? new Set(props.openApiOverrideFilePaths) : undefined}
                generatorsYmlPath={props.generatorsYmlPath}
                generatorsYmlContent={props.generatorsYmlContent}
            >
                {props.children}
                <DescriptionEditModal />
            </OpenApiSpecsProvider>
        </NavigationStoreProvider>
    );
}

/**
 * Preview-only version of ClientNavigationProvider that doesn't require GitHub data.
 * Used when displaying docs in preview mode without GitHub integration.
 */
export function PreviewClientNavigationProvider({
    children,
    branchName,
    orgName,
    docsUrl
}: {
    children: React.ReactNode;
    branchName: string;
    orgName: string;
    docsUrl: string;
}) {
    return (
        <PreviewNavigationStoreProvider branchName={branchName} orgName={orgName} docsUrl={docsUrl}>
            <OpenApiSpecsProvider specs={null} sourceType={null}>
                {children}
            </OpenApiSpecsProvider>
        </PreviewNavigationStoreProvider>
    );
}
