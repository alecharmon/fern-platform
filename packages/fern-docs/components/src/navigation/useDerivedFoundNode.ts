"use client";

import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useEffect, useMemo } from "react";
import { useNavigation } from "./NavigationStoreContext";
import type { SerializableFoundNode } from "./types";
import { getSerializableFoundNode } from "./types";

export interface UseDerivedFoundNodeOptions {
    /** The initial foundNode from the page data (fallback if RootNode not available) */
    initialFoundNode: SerializableFoundNode | undefined;
    /** Optional fallback foundNode for non-page nodes */
    fallbackFoundNode?: SerializableFoundNode;
    /** Optional RootNode to store in NavigationStore */
    serializableRootNode?: FernNavigation.RootNode;
}

export interface UseDerivedFoundNodeResult {
    /** The derived or fallback foundNode */
    foundNode: SerializableFoundNode | undefined;
    /** Whether the navigation store is hydrated */
    hydrated: boolean;
}

/**
 * Hook that derives foundNode from RootNode when available, otherwise falls back to stored foundNode.
 * Also handles storing the RootNode in NavigationStore.
 *
 * @example
 * ```tsx
 * const { foundNode, hydrated } = useDerivedFoundNode({
 *   initialFoundNode: initialPageData.foundNode,
 *   fallbackFoundNode: serializableFoundNode,
 *   serializableRootNode: rootFromServer
 * });
 *
 * if (!foundNode) return null;
 *
 * return <SetCurrentNavigationNode {...foundNode} />;
 * ```
 */
export function useDerivedFoundNode(options: UseDerivedFoundNodeOptions): UseDerivedFoundNodeResult {
    const { initialFoundNode, fallbackFoundNode, serializableRootNode } = options;
    const { hydrated, rootNode, setRootNode } = useNavigation();

    // Store the RootNode in NavigationStore if provided (only after hydration)
    useEffect(() => {
        if (hydrated && serializableRootNode && !rootNode) {
            setRootNode(serializableRootNode);
        }
    }, [hydrated, serializableRootNode, rootNode, setRootNode]);

    // Derive foundNode from RootNode if available, otherwise use the stored foundNode
    const derivedFoundNode = useMemo(() => {
        if (!rootNode || !initialFoundNode?.node) {
            return undefined;
        }

        // Use the slug from the initial page's node to find the current node in the RootNode
        const slug = initialFoundNode.node.slug;
        const found = FernNavigation.utils.findNode(rootNode, slug);

        if (found.type === "found") {
            return getSerializableFoundNode(found);
        }

        return undefined;
    }, [rootNode, initialFoundNode]);

    // Prefer derived foundNode from RootNode, fallback to initialFoundNode, then fallbackFoundNode
    const foundNode = derivedFoundNode ?? initialFoundNode ?? fallbackFoundNode;

    return {
        foundNode,
        hydrated
    };
}
