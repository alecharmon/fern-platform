"use client";

import { useMemo } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { MdxToHtmlResponse } from "@fern-docs/mdx";

import { UnsupportedContent } from "@/components/editor/UnsupportedContent";
import { CSSProvider } from "@/components/editor/extension-custom-element/CSSContext";
import { usePages } from "@/providers/PagesStoreContext";

import PageContents from "./PageContents";

export declare namespace PageNode {
    export interface Props {
        serializableFoundNode?: SerializableFoundNode;
        clientNodeId?: NodeId;
        initialFilename?: string;
        initialHtml?: MdxToHtmlResponse["html"];
        initialFrontmatter?: MdxToHtmlResponse["frontmatter"];
        initialOriginalFrontmatter?: MdxToHtmlResponse["originalFrontmatter"];
        cssConfig?: { inline?: string[] };
    }
}

export default function PageNode({ serializableFoundNode, clientNodeId, ...props }: PageNode.Props) {
    const { buildPageDataFromSources } = usePages();

    const { initialFilename, initialHtml, initialFrontmatter, initialOriginalFrontmatter, foundNode } = useMemo(
        () =>
            buildPageDataFromSources({
                ...props,
                serializableFoundNode,
                clientNodeId
            }),
        [buildPageDataFromSources, props, serializableFoundNode, clientNodeId]
    );

    const isUnsupportedNode = foundNode?.node.type !== "page" && foundNode?.node.type !== "section";

    // Early return if foundNode is not available or initial data is not available
    if (!foundNode) {
        return <UnsupportedContent>Page data could not be loaded.</UnsupportedContent>;
    }

    return (
        <>
            <SetCurrentNavigationNode
                nodeId={foundNode.node.id}
                sidebarRootNodeId={foundNode.sidebar?.id}
                tabId={foundNode.currentTab?.id}
                productId={foundNode.currentProduct?.productId}
                productSlug={foundNode.currentProduct?.slug}
                versionId={foundNode.currentVersion?.versionId}
                versionSlug={foundNode.currentVersion?.slug}
                versionIsDefault={foundNode.isCurrentVersionDefault}
                productIsDefault={foundNode.isCurrentProductDefault}
            />
            <CSSProvider cssConfig={props.cssConfig}>
                {isUnsupportedNode ? (
                    <UnsupportedContent>This page is not visible in the editor.</UnsupportedContent>
                ) : (
                    <PageContents
                        filename={initialFilename || foundNode.node.slug || "untitled"}
                        initialHtml={initialHtml ?? ""}
                        initialFrontmatter={initialFrontmatter ?? {}}
                        initialOriginalFrontmatter={initialOriginalFrontmatter}
                        clientNodeId={clientNodeId}
                    />
                )}
            </CSSProvider>
        </>
    );
}
