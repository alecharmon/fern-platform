"use client";

import type { ApiSourceType } from "@fern-api/docs-loader";
import {
    type DeletionToastCallback,
    NavigationStoreProvider,
    PreviewNavigationStoreProvider
} from "@fern-docs/components/navigation";

import { PageDeletedUndoToast } from "@/components/editor/EditorToasts";
import { OpenApiSpecsProvider } from "@/providers/OpenApiSpecsContext";

export interface ClientNavigationProviderProps {
    children: React.ReactNode;
    branchName: string;
    orgName: string;
    docsUrl: string;
    latestDocsYmlAndReferences: Map<string, string> | null;
    fernFolderPath?: string;
    openApiSpecs?: Map<string, string> | null;
    apiSourceType?: ApiSourceType | null;
}

export function ClientNavigationProvider(props: ClientNavigationProviderProps) {
    const deletionToastCallback: DeletionToastCallback = (pageTitle: string, onUndo: () => void) => {
        PageDeletedUndoToast(pageTitle, onUndo);
    };

    return (
        <NavigationStoreProvider
            branchName={props.branchName}
            orgName={props.orgName}
            docsUrl={props.docsUrl}
            latestDocsYmlAndReferences={props.latestDocsYmlAndReferences}
            fernFolderPath={props.fernFolderPath}
            deletionToastCallback={deletionToastCallback}
        >
            <OpenApiSpecsProvider specs={props.openApiSpecs ?? null} sourceType={props.apiSourceType ?? null}>
                {props.children}
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
