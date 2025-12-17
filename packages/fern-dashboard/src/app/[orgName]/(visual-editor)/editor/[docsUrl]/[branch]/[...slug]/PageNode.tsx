"use client";

import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import {
    type ClientPageDataDependencies,
    type ResolvedPageData,
    type SerializableFoundNode,
    type ServerPageDataDependencies,
    useDerivedFoundNode,
    useNavigation
} from "@fern-docs/components/navigation";
import NotFoundContent from "@fern-docs/components/not-found/NotFoundContent";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { UnsupportedContentDisplayOnly } from "@/components/editor/UnsupportedContent";
import { useCurrentPage } from "@/providers/CurrentPageContext";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import PageContents from "./PageContents";

export declare namespace PageNode {
    export type Props = {
        /** Resolves to initial data for page nodes */
        pageDataDeps: ClientPageDataDependencies | ServerPageDataDependencies;
        /** Directly accepts found node from loader for non-page nodes (e.g. "endpoint") */
        fallbackFoundNode?: SerializableFoundNode;
        /** Root node from server to store in NavigationStore */
        serializableRootNode?: FernNavigation.RootNode;
    };
}

const SUPPORTED_NODE_TYPES = new Set(["page", "section", "landingPage", "apiReference", "apiPackage"]);

export default function PageNode(props: PageNode.Props) {
    const { pageDataDeps, fallbackFoundNode, serializableRootNode } = props;

    const { resolveInitialPageData, registerPage } = useNavigation();
    const { setCurrentFilename } = useCurrentPage();
    const { docsUrl, branch } = useGitHubRepo();
    const params = useParams<{ slug: string[] }>();

    // Store initial page data in a ref so we don't re-resolve it on every render
    const initialPageDataRef = useRef<ResolvedPageData | null>(null);
    const didRegisterPage = useRef(false);

    const { foundNode, hydrated } = useDerivedFoundNode({
        initialFoundNode: pageDataDeps ? initialPageDataRef.current?.foundNode : fallbackFoundNode,
        fallbackFoundNode,
        serializableRootNode
    });

    const initialPageData = useMemo(() => {
        return hydrated && !initialPageDataRef.current
            ? (initialPageDataRef.current = resolveInitialPageData(pageDataDeps))
            : initialPageDataRef.current;
    }, [hydrated, resolveInitialPageData, pageDataDeps]);

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
    }, [initialPageData, registerPage, setCurrentFilename]);

    // Show blank while navigation store is hydrating (loading UI shown elsewhere)
    if (!hydrated) {
        return null;
    }

    // Handle not found case (only after hydration)
    if (!initialPageData || !foundNode) {
        console.error("[PageNode] Page was not able to be resolved:", { initialPageData, foundNode });

        // Use slugjoin to get the clean navigation slug from the route params
        const slug = slugjoin(params.slug);

        return (
            <NotFoundContent
                lang="en"
                className="max-w-full not-prose -my-12"
                docsUrl={docsUrl}
                slug={slug}
                branch={branch}
                hideSubtitle={true}
            />
        );
    }

    // foundNode from useDerivedFoundNode already includes fallbackFoundNode merge logic
    const found = foundNode;

    if (!SUPPORTED_NODE_TYPES.has(foundNode.node.type)) {
        return (
            <UnsupportedContentDisplayOnly>
                This page type is not visible in Fern Editor: &ldquo;
                {foundNode.node.type}
                &rdquo;
            </UnsupportedContentDisplayOnly>
        );
    }

    return (
        <>
            <SetCurrentNavigationNode
                nodeId={found.node.id}
                sidebarRootNodeId={found.sidebar?.id}
                tabId={found.currentTab?.id}
                productId={found.currentProduct?.productId}
                productSlug={
                    found.currentProduct && FernNavigation.isInternalProductNode(found.currentProduct)
                        ? found.currentProduct.slug
                        : undefined
                }
                versionId={found.currentVersion?.versionId}
                versionSlug={found.currentVersion?.slug}
                variantId={found.currentVariant?.variantId}
                versionIsDefault={found.isCurrentVersionDefault}
                productIsDefault={found.isCurrentProductDefault}
            />
            <PageContents
                filename={initialPageData.filename}
                initialHtml={initialPageData.html}
                initialFrontmatter={initialPageData.frontmatter}
                foundNode={found}
            />
        </>
    );
}
