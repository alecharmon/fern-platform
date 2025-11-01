"use client";

import { type DeletionToastCallback, NavigationStoreProvider } from "@fern-docs/components/navigation";

import { PageDeletedUndoToast } from "@/components/editor/EditorToasts";

export interface ClientNavigationProviderProps {
    children: React.ReactNode;
    branchName: string;
    orgName: string;
    docsUrl: string;
    latestDocsYmlAndReferences: Map<string, string> | null;
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
            deletionToastCallback={deletionToastCallback}
        >
            {props.children}
        </NavigationStoreProvider>
    );
}
