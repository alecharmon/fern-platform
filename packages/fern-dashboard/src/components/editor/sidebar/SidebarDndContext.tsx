"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import {
    createContext,
    type ReactNode,
    type SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

/** Where the drop will occur relative to the target element */
export type DropPosition = "before" | "after" | "inside";

/** Describes the node currently being dragged */
export interface DraggedNode {
    nodeId: FernNavigation.NodeId;
    nodeType: "page" | "section";
    /** The tab slug context of the dragged node (undefined if not in a tab) */
    tabSlug?: string;
}

/** Describes the current drop target */
export interface DropTarget {
    nodeId: FernNavigation.NodeId;
    position: DropPosition;
    /** The parent container ID where the drop would insert */
    parentId: FernNavigation.NodeId;
    /** The computed insertion index within the parent */
    insertionIndex: number;
}

export interface SidebarDndContextValue {
    /** The node currently being dragged, or null */
    draggedNode: DraggedNode | null;
    /** The current drop target, or null */
    dropTarget: DropTarget | null;
    /** Called when drag starts on a node */
    startDrag: (node: DraggedNode) => void;
    /** Called when drag ends (drop or cancel) */
    endDrag: () => void;
    /** Update the current drop target (supports functional updates) */
    setDropTarget: (target: SetStateAction<DropTarget | null>) => void;
    /** Signal that a drop landed on a valid zone (called from handleDrop) */
    markDropAccepted: () => void;
    /** Check whether the current drag ended with a valid drop */
    wasDropAccepted: () => boolean;
    /**
     * Schedule a deferred clear of dropTarget (100 ms timeout).  Called from
     * `dragLeave` handlers.  If a `dragOver` fires on any sibling/child before
     * the timeout, the clear is cancelled — preventing the null flicker that
     * caused indicator flickering between adjacent elements.
     */
    scheduleClearDropTarget: () => void;
    /** Cancel a pending deferred clear (called at the top of every dragOver). */
    cancelClearDropTarget: () => void;
    /** Whether a drag is currently in progress */
    isDragging: boolean;
}

const SidebarDndContext = createContext<SidebarDndContextValue | null>(null);

export function SidebarDndProvider({ children }: { children: ReactNode }): ReactNode {
    const [draggedNode, setDraggedNode] = useState<DraggedNode | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

    // ---- drop-accepted ref ----
    // Set in handleDrop, checked in handleDragEnd, reset in endDrag.
    // Using a ref (not state) avoids re-renders and is synchronously readable
    // in the same event-loop tick as the drop → dragend sequence.
    const dropAcceptedRef = useRef(false);

    // ---- Deferred clear ----
    // dragLeave schedules a clear; the next dragOver cancels it.
    // We use a short timeout (100ms) rather than requestAnimationFrame because
    // browsers fire dragover at an interval (~16ms at 60fps), NOT synchronously
    // with dragLeave.  A RAF can fire between the two, clearing the target for
    // one frame and causing flicker.  100ms is long enough for several dragover
    // events to fire and cancel the clear, but short enough that stale indicators
    // disappear promptly when the cursor truly leaves all drop zones.
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const cancelClearDropTarget = useCallback(() => {
        if (clearTimerRef.current != null) {
            clearTimeout(clearTimerRef.current);
            clearTimerRef.current = undefined;
        }
    }, []);

    const scheduleClearDropTarget = useCallback(() => {
        cancelClearDropTarget();
        clearTimerRef.current = setTimeout(() => {
            clearTimerRef.current = undefined;
            setDropTarget(null);
        }, 100);
    }, [cancelClearDropTarget]);

    const startDrag = useCallback(
        (node: DraggedNode) => {
            dropAcceptedRef.current = false;
            cancelClearDropTarget();
            setDraggedNode(node);
        },
        [cancelClearDropTarget]
    );

    const endDrag = useCallback(() => {
        dropAcceptedRef.current = false;
        cancelClearDropTarget();
        setDraggedNode(null);
        setDropTarget(null);
    }, [cancelClearDropTarget]);

    const markDropAccepted = useCallback(() => {
        dropAcceptedRef.current = true;
    }, []);

    const wasDropAccepted = useCallback(() => dropAcceptedRef.current, []);

    // Clean up pending timer on unmount
    useEffect(() => cancelClearDropTarget, [cancelClearDropTarget]);

    const isDragging = draggedNode != null;

    const value = useMemo<SidebarDndContextValue>(
        () => ({
            draggedNode,
            dropTarget,
            startDrag,
            endDrag,
            setDropTarget,
            markDropAccepted,
            wasDropAccepted,
            scheduleClearDropTarget,
            cancelClearDropTarget,
            isDragging
        }),
        [
            draggedNode,
            dropTarget,
            startDrag,
            endDrag,
            markDropAccepted,
            wasDropAccepted,
            scheduleClearDropTarget,
            cancelClearDropTarget,
            isDragging
        ]
    );

    return <SidebarDndContext.Provider value={value}>{children}</SidebarDndContext.Provider>;
}

export function useSidebarDnd(): SidebarDndContextValue {
    const context = useContext(SidebarDndContext);
    if (!context) {
        throw new Error("useSidebarDnd must be used within a SidebarDndProvider");
    }
    return context;
}
