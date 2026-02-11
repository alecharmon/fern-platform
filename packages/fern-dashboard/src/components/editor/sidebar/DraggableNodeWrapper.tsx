"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import {
    findNodeTabSlug,
    findParentNodeId,
    getChildrenOfNode,
    isDescendantOf,
    useNavigation
} from "@fern-docs/components/navigation";
import { GripVertical } from "lucide-react";
import { type ReactNode, useCallback, useRef } from "react";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { DropIndicator } from "./DropIndicator";
import { type DropPosition, useSidebarDnd } from "./SidebarDndContext";

// ---------------------------------------------------------------------------
// DraggableNodeWrapper — combined drag source + drop zone for **pages** only.
// ---------------------------------------------------------------------------

interface DraggableNodeWrapperProps {
    node: FernNavigation.NavigationNode;
    nodeType: "page";
    children: ReactNode;
}

/**
 * Wraps a sidebar **page** node to make it draggable and act as a drop zone.
 * Uses HTML5 native drag events (no library dependency).
 *
 * Drop position detection: top 50% → before, bottom 50% → after.
 *
 * **Event propagation:** calls `stopPropagation()` on every drag handler so
 * that a parent section drop-zone doesn't overwrite the page-level target.
 */
export function DraggableNodeWrapper({ node, nodeType, children }: DraggableNodeWrapperProps): ReactNode {
    const {
        draggedNode,
        dropTarget,
        startDrag,
        endDrag,
        setDropTarget,
        markDropAccepted,
        wasDropAccepted,
        scheduleClearDropTarget,
        cancelClearDropTarget
    } = useSidebarDnd();
    const navigation = useNavigation();
    const isEditingDisabled = useEditingDisabled();
    const elementRef = useRef<HTMLDivElement>(null);

    const rootNode = navigation.rootNode;

    const isDraggable = !isEditingDisabled;

    // Check if this node (or an ancestor section) is the one being dragged
    const isBeingDragged = draggedNode?.nodeId === node.id;
    const isAncestorBeingDragged =
        !isBeingDragged &&
        draggedNode != null &&
        draggedNode.nodeType === "section" &&
        rootNode != null &&
        isDescendantOf(rootNode, draggedNode.nodeId, node.id);

    // Check if the drop indicator should show relative to this node
    const showDropBefore = dropTarget?.nodeId === node.id && dropTarget.position === "before";
    const showDropAfter = dropTarget?.nodeId === node.id && dropTarget.position === "after";

    const handleDragStart = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (!isDraggable) {
                e.preventDefault();
                return;
            }

            e.stopPropagation();

            e.dataTransfer.setData("text/plain", String(node.id));
            e.dataTransfer.effectAllowed = "move";

            if (elementRef.current) {
                e.dataTransfer.setDragImage(elementRef.current, 0, 0);
            }

            const sourceTabSlug = rootNode ? findNodeTabSlug(rootNode, node.id) : undefined;
            startDrag({ nodeId: node.id, nodeType, tabSlug: sourceTabSlug });
        },
        [isDraggable, node.id, nodeType, startDrag, rootNode]
    );

    const handleDragEnd = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.stopPropagation();

            // Only execute the move if handleDrop fired on a valid zone.
            // Without this guard, dropping outside the sidebar would still move
            // the node to the last hovered position (since we removed dragLeave).
            if (wasDropAccepted() && draggedNode && dropTarget && rootNode) {
                navigation.moveNode(draggedNode.nodeId, dropTarget.parentId, dropTarget.insertionIndex);
            }
            endDrag();
        },
        [wasDropAccepted, draggedNode, dropTarget, rootNode, navigation, endDrag]
    );

    const handleDragOver = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            // Cancel any pending deferred clear — we're still over a valid zone.
            cancelClearDropTarget();

            if (!draggedNode || !rootNode) {
                return;
            }

            if (draggedNode.nodeId === node.id) {
                return;
            }

            if (draggedNode.nodeType === "section" && isDescendantOf(rootNode, draggedNode.nodeId, node.id)) {
                return;
            }

            const targetTabSlug = findNodeTabSlug(rootNode, node.id);
            if (draggedNode.tabSlug !== targetTabSlug) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";

            const rect = elementRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }

            const relativeY = e.clientY - rect.top;
            const fraction = relativeY / rect.height;

            // Pages have 2 zones: before (top 50%), after (bottom 50%)
            const position: DropPosition = fraction < 0.5 ? "before" : "after";

            const parentId = _computeParentId(position, node, rootNode);
            const insertionIndex = _computeInsertionIndex(position, node, parentId, rootNode);

            if (parentId == null) {
                return;
            }

            // Deduplicate by insertion point (parentId + insertionIndex) rather than
            // nodeId + position.  "after page N" and "before page N+1" resolve to the
            // same insertion index — deduplicating prevents the indicator from flickering
            // between the two slightly-different vertical positions.
            if (dropTarget?.parentId === parentId && dropTarget?.insertionIndex === insertionIndex) {
                return;
            }

            setDropTarget({
                nodeId: node.id,
                position,
                parentId,
                insertionIndex
            });
        },
        [cancelClearDropTarget, draggedNode, rootNode, node, dropTarget, setDropTarget]
    );

    const handleDragLeave = useCallback(() => {
        scheduleClearDropTarget();
    }, [scheduleClearDropTarget]);

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            markDropAccepted();
        },
        [markDropAccepted]
    );

    return (
        <div
            ref={elementRef}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="group/draggable relative"
            style={{ opacity: isBeingDragged || isAncestorBeingDragged ? 0.4 : 1 }}
        >
            {/* Drop indicator before */}
            <DropIndicator visible={showDropBefore} />

            {/* Drag handle */}
            {isDraggable && (
                <div
                    className="absolute left-0 top-1/2 z-10 -translate-x-full -translate-y-1/2 cursor-grab rounded-md px-0.5 py-1 opacity-0 transition-opacity duration-150 hover:bg-gray-500/40 group-hover/draggable:opacity-100 active:cursor-grabbing"
                    aria-label="Drag to reorder"
                >
                    <GripVertical className="size-3.5 text-muted-foreground" />
                </div>
            )}

            <div>{children}</div>

            {/* Drop indicator after */}
            <DropIndicator visible={showDropAfter} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// SectionDropZone — drop zone wrapper for **sections** (heading + children).
// The heading inside is also the drag source (draggable, drag handle).
// ---------------------------------------------------------------------------

/** Pixel threshold at top/bottom of the section wrapper for before/after zones. */
const SECTION_EDGE_ZONE_PX = 6;

interface SectionDropZoneProps {
    node: FernNavigation.SectionNode;
    children: ReactNode;
}

/**
 * Wraps an entire section (heading + children) to act as a drop zone **and**
 * drag source.
 *
 * Drop zones:
 * - Top edge (`SECTION_EDGE_ZONE_PX`) → **before** (insert before section at parent level)
 * - Bottom edge (`SECTION_EDGE_ZONE_PX`) → **after** (insert after section at parent level)
 * - Everything else (100% of the header) → **inside at index 0**
 *
 * The drag handle is rendered by `SidebarSectionNodeWithMenu` (inside the
 * heading) so that it naturally participates in the heading's `group-hover`.
 * This wrapper provides the `draggable` attribute and drag event handlers;
 * the handle is purely visual.
 *
 * Bottom padding (`pb-1.5`) provides physical space for the "after" zone
 * that child page wrappers (which call `stopPropagation`) would otherwise
 * cover.
 */
export function SectionDropZone({ node, children }: SectionDropZoneProps): ReactNode {
    const {
        draggedNode,
        dropTarget,
        startDrag,
        endDrag,
        setDropTarget,
        markDropAccepted,
        wasDropAccepted,
        scheduleClearDropTarget,
        cancelClearDropTarget
    } = useSidebarDnd();
    const navigation = useNavigation();
    const isEditingDisabled = useEditingDisabled();
    const elementRef = useRef<HTMLDivElement>(null);

    const rootNode = navigation.rootNode;

    const isDraggable = !isEditingDisabled;

    const isBeingDragged = draggedNode?.nodeId === node.id;

    // ---- Drop indicator state ----
    const showDropBefore = dropTarget?.nodeId === node.id && dropTarget.position === "before";
    const showDropAfter = dropTarget?.nodeId === node.id && dropTarget.position === "after";
    const showDropInside = dropTarget?.nodeId === node.id && dropTarget.position === "inside";

    // ---- Drag source handlers (section heading) ----
    const handleDragStart = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (!isDraggable) {
                e.preventDefault();
                return;
            }

            e.stopPropagation();

            e.dataTransfer.setData("text/plain", String(node.id));
            e.dataTransfer.effectAllowed = "move";

            if (elementRef.current) {
                e.dataTransfer.setDragImage(elementRef.current, 0, 0);
            }

            const sourceTabSlug = rootNode ? findNodeTabSlug(rootNode, node.id) : undefined;
            startDrag({ nodeId: node.id, nodeType: "section", tabSlug: sourceTabSlug });
        },
        [isDraggable, node.id, startDrag, rootNode]
    );

    const handleDragEnd = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.stopPropagation();

            if (wasDropAccepted() && draggedNode && dropTarget && rootNode) {
                navigation.moveNode(draggedNode.nodeId, dropTarget.parentId, dropTarget.insertionIndex);
            }
            endDrag();
        },
        [wasDropAccepted, draggedNode, dropTarget, rootNode, navigation, endDrag]
    );

    // ---- Drop zone handlers ----

    const handleDragOver = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            // Cancel any pending deferred clear — we're still over a valid zone.
            cancelClearDropTarget();

            if (!draggedNode || !rootNode) {
                return;
            }

            if (draggedNode.nodeId === node.id) {
                return;
            }

            if (draggedNode.nodeType === "section" && isDescendantOf(rootNode, draggedNode.nodeId, node.id)) {
                return;
            }

            const targetTabSlug = findNodeTabSlug(rootNode, node.id);
            if (draggedNode.tabSlug !== targetTabSlug) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";

            const rect = elementRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }

            const relativeY = e.clientY - rect.top;

            let position: DropPosition;
            let insertionIndexOverride: number | undefined;

            // Top edge → before, bottom edge → after, rest → inside at 0
            if (relativeY < SECTION_EDGE_ZONE_PX) {
                position = "before";
            } else if (rect.height - relativeY < SECTION_EDGE_ZONE_PX) {
                position = "after";
            } else {
                position = "inside";
                insertionIndexOverride = 0;
            }

            // When the cursor passes through gaps between child <li> elements, no
            // child calls stopPropagation, so this handler fires and computes
            // "inside".  If the current target is already a child of this section
            // AND the cursor is NOT over the heading, keep the child's indicator —
            // it's more precise and avoids a one-frame section-ring flash.
            //
            // We allow "inside" when the cursor is genuinely over the heading
            // (detected via e.target being inside .sidebar-section-node-with-menu).
            if (
                position === "inside" &&
                dropTarget != null &&
                dropTarget.parentId === node.id &&
                dropTarget.position !== "inside"
            ) {
                const target = e.target as HTMLElement;
                const heading = elementRef.current?.querySelector(".sidebar-section-node-with-menu");
                if (!heading || !heading.contains(target)) {
                    return;
                }
            }

            const parentId = _computeParentId(position, node, rootNode);
            const insertionIndex = insertionIndexOverride ?? _computeInsertionIndex(position, node, parentId, rootNode);

            if (parentId == null) {
                return;
            }

            // Deduplicate by insertion point.  "after section S" and "before next
            // sibling" resolve to the same index — deduplicating prevents the indicator
            // from jumping between the two wrapper positions.  We also distinguish
            // "inside" from non-inside so the section ring still shows when appropriate.
            if (
                dropTarget?.parentId === parentId &&
                dropTarget?.insertionIndex === insertionIndex &&
                (dropTarget?.position === "inside") === (position === "inside")
            ) {
                return;
            }

            setDropTarget({
                nodeId: node.id,
                position,
                parentId,
                insertionIndex
            });
        },
        [cancelClearDropTarget, draggedNode, rootNode, node, dropTarget, setDropTarget]
    );

    const handleDragLeave = useCallback(() => {
        scheduleClearDropTarget();
    }, [scheduleClearDropTarget]);

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            markDropAccepted();
        },
        [markDropAccepted]
    );

    return (
        <div
            ref={elementRef}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative pb-1.5"
            style={{ opacity: isBeingDragged ? 0.4 : 1 }}
        >
            {/* Drop indicator before — offset upward to sit at the edge-zone boundary */}
            <DropIndicator visible={showDropBefore} offsetY={-SECTION_EDGE_ZONE_PX} />

            {/* Drag handle is rendered by SidebarSectionNodeWithMenu (inside children)
                so it participates in the heading's group-hover naturally. */}

            {/* Inner "inside" highlight for sections */}
            <div className={showDropInside ? "rounded-md ring-2 ring-primary/60 ring-inset" : ""}>{children}</div>

            {/* Drop indicator after — offset downward to sit at the edge-zone boundary */}
            <DropIndicator visible={showDropAfter} offsetY={SECTION_EDGE_ZONE_PX} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Compute the parent container ID for the drop */
function _computeParentId(
    position: DropPosition,
    targetNode: FernNavigation.NavigationNode,
    rootNode: FernNavigation.RootNode
): FernNavigation.NodeId | undefined {
    if (position === "inside" && targetNode.type === "section") {
        // Dropping inside a section → the section IS the parent
        return targetNode.id;
    }

    // Dropping before/after → the parent is the target node's parent
    return findParentNodeId(rootNode, targetNode.id);
}

/** Compute the insertion index for the drop within the parent */
function _computeInsertionIndex(
    position: DropPosition,
    targetNode: FernNavigation.NavigationNode,
    parentId: FernNavigation.NodeId | undefined,
    rootNode: FernNavigation.RootNode
): number {
    if (position === "inside") {
        // Dropping inside a section → append at end (index 0 for empty, or end)
        if (targetNode.type === "section") {
            return (targetNode as FernNavigation.SectionNode).children.length;
        }
        return 0;
    }

    if (!parentId) {
        return 0;
    }

    // Find the target node's index within its parent's children
    const parentChildren = getChildrenOfNode(rootNode, parentId);
    if (!parentChildren) {
        return 0;
    }

    const targetIndex = parentChildren.findIndex((child) => child.id === targetNode.id);
    if (targetIndex < 0) {
        return parentChildren.length;
    }

    return position === "before" ? targetIndex : targetIndex + 1;
}
