"use client";

import {
    type DeletionToastCallback,
    NavigationStoreProvider,
    PreviewNavigationStoreProvider
} from "@fern-docs/components/navigation";

import { PageDeletedUndoToast } from "@/components/editor/EditorToasts";

export interface ClientNavigationProviderProps {
    children: React.ReactNode;
    branchName: string;
    orgName: string;
    docsUrl: string;
    latestDocsYmlAndReferences: Map<string, string> | null;
    fernFolderPath?: string;
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
            {props.children}
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
            {children}
        </PreviewNavigationStoreProvider>
    );
}
