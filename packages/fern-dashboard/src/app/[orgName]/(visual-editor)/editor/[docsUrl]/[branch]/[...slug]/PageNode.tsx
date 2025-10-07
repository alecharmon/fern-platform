"use client";

import {
    type ClientPageDataDependencies,
    mergeFoundNodes,
    type ResolvedPageData,
    type SerializableFoundNode,
    type ServerPageDataDependencies,
    useNavigation
} from "@fern-docs/components/navigation";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { useEffect, useRef } from "react";
import { CSSProvider } from "@/components/editor/extension-custom-element/CSSContext";
import { UnsupportedContent } from "@/components/editor/UnsupportedContent";
import { useCurrentPage } from "@/providers/CurrentPageContext";

import PageContents from "./PageContents";

export declare namespace PageNode {
    export type Props = {
        /** Resolves to initial data for page nodes */
        pageDataDeps: ClientPageDataDependencies | ServerPageDataDependencies;
        /** Directly accepts found node from loader for non-page nodes (e.g. "endpoint") */
        fallbackFoundNode?: SerializableFoundNode;
        cssConfig?: { inline?: string[] };
    };
}

export default function PageNode(props: PageNode.Props) {
    const { pageDataDeps, fallbackFoundNode, cssConfig } = props;

    const { hydrated, resolveInitialPageData, registerPage } = useNavigation();
    const { setCurrentFilename } = useCurrentPage();

    // Store initial page data in a ref so we don't re-resolve it on every render
    const initialPageDataRef = useRef<ResolvedPageData>(null);
    const initialPageData =
        hydrated && !initialPageDataRef.current
            ? (initialPageDataRef.current = resolveInitialPageData(pageDataDeps))
            : initialPageDataRef.current;

    const didRegisterPage = useRef(false);
    useEffect(() => {
        if (didRegisterPage.current) {
            return;
        }
        if (initialPageData) {
            registerPage(initialPageData);
            didRegisterPage.current = true;
            // Set current filename so @devPanel knows about the current page
            setCurrentFilename(initialPageData.filename);
        }
    }, [hydrated, initialPageData, registerPage, setCurrentFilename]);

    if (!initialPageData) {
        // TODO: show a loading state
        return null;
    }

    const initialFoundNode = initialPageData.foundNode;

    if (!initialFoundNode) {
        return (
            <UnsupportedContent>
                This page is not visible in Fern Editor: &ldquo;
                {pageDataDeps.filename}
                &rdquo;
            </UnsupportedContent>
        );
    }

    const found = mergeFoundNodes(initialFoundNode, fallbackFoundNode);

    const isUnsupportedNodeType = initialFoundNode.node.type !== "page" && initialFoundNode.node.type !== "section";

    if (isUnsupportedNodeType) {
        return (
            <UnsupportedContent>
                This page type is not visible in Fern Editor: &ldquo;
                {initialFoundNode.node.type}
                &rdquo;
            </UnsupportedContent>
        );
    }

    return (
        <>
            <SetCurrentNavigationNode
                nodeId={found.node.id}
                sidebarRootNodeId={found.sidebar?.id}
                tabId={found.currentTab?.id}
                productId={found.currentProduct?.productId}
                productSlug={found.currentProduct?.slug}
                versionId={found.currentVersion?.versionId}
                versionSlug={found.currentVersion?.slug}
                versionIsDefault={found.isCurrentVersionDefault}
                productIsDefault={found.isCurrentProductDefault}
            />
            <CSSProvider cssConfig={cssConfig}>
                <PageContents
                    filename={initialPageData.filename}
                    initialHtml={initialPageData.html}
                    initialFrontmatter={initialPageData.frontmatter}
                />
            </CSSProvider>
        </>
    );
}
