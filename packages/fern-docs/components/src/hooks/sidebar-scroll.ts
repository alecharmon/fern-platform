"use client";

import { isomorphicRequestIdleCallback, useIsomorphicLayoutEffect } from "@fern-ui/react-commons";
import React from "react";

import { FERN_SIDEBAR_SCROLL_AREA_ID } from "../constants";
import { useIsSelectedSidebarNode } from "../state/navigation";
import { scrollToCenter } from "../util/scrollToCenter";

let justScrolledTo: string | undefined;

export function useRestoreSidebarScrollPosition() {
    useIsomorphicLayoutEffect(() => {
        const container = document.getElementById(FERN_SIDEBAR_SCROLL_AREA_ID);
        if (!container) return;
        // @ts-expect-error - window._FERN_SIDEBAR_SCROLL_RESTORATION is a custom property
        container.scrollTop = window._FERN_SIDEBAR_SCROLL_RESTORATION ?? 0;
    }, []);
}

/**
 * In the app router the sidebar gets scrolled to the top between page loads.
 * This is a hack to measure the scroll position so that the sidebar scroll position is restored
 * when the sidebar is re-mounted.
 */
export function useDismountMeasureSidebarScrollPosition(ref: React.RefObject<HTMLDivElement | null>) {
    React.useEffect(() => {
        const current = ref.current;
        // @ts-expect-error - window._FERN_SIDEBAR_SCROLL_RESTORATION is a custom property
        window._FERN_SIDEBAR_SCROLL_RESTORATION ??= 0;
        // @ts-expect-error - window._FERN_SIDEBAR_SCROLL_RESTORATION is a custom property
        if (current && window._FERN_SIDEBAR_SCROLL_RESTORATION > 0) {
            // @ts-expect-error - window._FERN_SIDEBAR_SCROLL_RESTORATION is a custom property
            current.scrollTop = window._FERN_SIDEBAR_SCROLL_RESTORATION;
        }

        if (current == null) {
            return;
        }

        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            // 16 seems to be the magic number for a scroll-to-top event
            if (target.scrollTop !== 16) {
                // @ts-expect-error - window._FERN_SIDEBAR_SCROLL_RESTORATION is a custom property
                window._FERN_SIDEBAR_SCROLL_RESTORATION = target.scrollTop;
            }
        };

        current.addEventListener("scroll", handleScroll);

        return () => {
            current.removeEventListener("scroll", handleScroll);
            justScrolledTo = undefined;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}

export function useScrollSidebarNodeIntoView(ref: React.RefObject<HTMLElement | null>, nodeId?: string) {
    const shouldScrollIntoView = useIsSelectedSidebarNode(nodeId ?? ("" as any));
    useIsomorphicLayoutEffect(() => {
        const scrollTo = () => {
            const container = document.getElementById(FERN_SIDEBAR_SCROLL_AREA_ID);
            if (!container) return;
            // @ts-expect-error - window._FERN_SIDEBAR_SCROLL_RESTORATION is a custom property
            container.scrollTop = window._FERN_SIDEBAR_SCROLL_RESTORATION ?? 0;

            const element = ref.current;
            if (!element) return;

            const containerBounds = container.getBoundingClientRect();
            const elementBounds = element.getBoundingClientRect();

            const isAbove = elementBounds.top < containerBounds.top;
            const isBelow = elementBounds.bottom > containerBounds.bottom;

            if (isAbove || isBelow) {
                scrollToCenter(container, element, isBelow);
            }
        };

        if (shouldScrollIntoView) {
            if (justScrolledTo === nodeId) {
                return;
            }
            justScrolledTo = nodeId;
            // @ts-expect-error - window.__FERN_CANCEL_SCROLL_SIDEBAR_NODE_INTO_VIEW is a custom property
            window.__FERN_CANCEL_SCROLL_SIDEBAR_NODE_INTO_VIEW?.();
            const cancel = isomorphicRequestIdleCallback(() => {
                scrollTo();
            });
            // @ts-expect-error - window._FERN_SIDEBAR_SCROLL_RESTORATION is a custom property
            window.__FERN_CANCEL_SCROLL_SIDEBAR_NODE_INTO_VIEW = cancel;
            return cancel;
        }

        return;
    }, [shouldScrollIntoView]);
}
