import fastdom from "fastdom";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { useCallbackOne } from "use-memo-one";

import { SCROLL_BODY_ATOM } from "../state/viewport";

const HEADER_SELECTOR = ".fern-header-content";

function getScrollPaddingTop(): number {
    const computed = getComputedStyle(document.documentElement).scrollPaddingTop;
    return parseFloat(computed) || 0;
}

function toIdQuerySelector(id: string): string {
    if (id.startsWith("#")) {
        return id;
    }

    /**
     * Escape leading digits with `\3` + trailing space to prevent it from being interpreted as a CSS escape sequence.
     * https://mathiasbynens.be/notes/css-escapes
     */
    return `#${CSS.escape(id)}`;
}

/**
 *
 * This hook observes the visibility of <h1> to <h6> elements that are tracked in the table of contents.
 * IntersectionObserver is not used because it is not as reactive as scroll events, and only measures the intersection of the directly observed elements.
 *
 * Algorithm:
 * - on mount, or page resize, measure the top Y position of each element
 * - on scroll event, determine which is the last element that is visible above 40% of the viewport height
 *
 * implicit assumption: the content that immediately follows an anchor (heading) is assumed to be the content that the anchor represents,
 * and is considered to be a factor in determining the visibility of the anchor ID.
 *
 * @param ids the ids of the elements to observe
 * @param setActiveIds the function to call with all anchors that intersect the viewport (after accounting for the sticky header)
 * @returns a function to call to trigger another measurement (to be called between page views)
 */
export function useTableOfContentsObserver(ids: string[], setActiveIds: (ids: string[]) => void): () => void {
    const idToYRef = useRef<Record<string, number>>({});
    const root = useAtomValue(SCROLL_BODY_ATOM);
    const rafIdRef = useRef<number | null>(null);
    const scrollPaddingTopRef = useRef(0);

    /**
     * on every scroll event, measure the top Y position of each element and determine
     * which is the last element that is visible above 40% of the viewport height
     */
    const take = useCallbackOne(() => {
        if (!root) {
            setActiveIds([]);
            return;
        }
        fastdom.measure(() => {
            const scrollY = root instanceof Document ? window.scrollY : root.scrollTop;
            const scrollHeight = root instanceof Document ? document.body.scrollHeight : root.scrollHeight;
            const clientHeight = root instanceof Document ? window.innerHeight : root.clientHeight;
            const rootTop = root instanceof Document ? 0 : root.getBoundingClientRect().top;
            const intersectionTop = scrollY + rootTop;
            const intersectionBottom = scrollY + rootTop + clientHeight;

            const scrollPaddingTop = scrollPaddingTopRef.current;
            const targetLine = intersectionTop + scrollPaddingTop + 10;

            const visibleIds: string[] = [];
            let lastAnchorBeforeViewport: string | undefined;
            for (const id of ids) {
                const y = idToYRef.current[id];
                if (y == null) {
                    continue;
                }

                if (y > intersectionBottom) {
                    break;
                }

                if (y < targetLine) {
                    lastAnchorBeforeViewport = id;
                    continue;
                }

                if (y >= targetLine && y <= intersectionBottom) {
                    visibleIds.push(id);
                }
            }

            if (lastAnchorBeforeViewport && !visibleIds.includes(lastAnchorBeforeViewport)) {
                visibleIds.unshift(lastAnchorBeforeViewport);
            }

            if (scrollY === 0) {
                const firstAnchor = ids[0];
                if (firstAnchor && !visibleIds.includes(firstAnchor)) {
                    visibleIds.unshift(firstAnchor);
                }
            } else if (scrollHeight - clientHeight - scrollY <= 1) {
                // At the bottom of the page - ensure last anchor is active
                const lastAnchor = ids[ids.length - 1];
                if (lastAnchor) {
                    // Clear and set only the last anchor as active when at bottom
                    visibleIds.length = 0;
                    visibleIds.push(lastAnchor);
                }
            }

            if (visibleIds.length === 0 && ids[0]) {
                visibleIds.push(ids[0]);
            }

            const visibleSet = new Set(visibleIds);
            let firstIndex = -1;
            let lastIndex = -1;
            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                if (!id) {
                    continue;
                }
                if (visibleSet.has(id)) {
                    if (firstIndex === -1) {
                        firstIndex = i;
                    }
                    lastIndex = i;
                }
            }

            let contiguousVisibleIds: string[] = [];
            if (firstIndex !== -1 && lastIndex !== -1) {
                contiguousVisibleIds = ids.slice(firstIndex, lastIndex + 1);
            }

            setActiveIds(contiguousVisibleIds);
        });
    }, [ids, root, setActiveIds]);

    const updateScrollPaddingTop = useCallbackOne(() => {
        fastdom.measure(() => {
            const measuredScrollPaddingTop = getScrollPaddingTop();
            if (measuredScrollPaddingTop !== scrollPaddingTopRef.current) {
                scrollPaddingTopRef.current = measuredScrollPaddingTop;
                take();
            }
        });
    }, [take]);

    /**
     * when the page is mounted or resized, measure the top Y position of each element
     */
    const measure = useCallbackOne(() => {
        if (!root) {
            return;
        }
        updateScrollPaddingTop();
        fastdom.measure(() => {
            const scrollY = root instanceof Document ? window.scrollY : root.scrollTop;
            const top = root instanceof Document ? 0 : root.getBoundingClientRect().top;
            try {
                idToYRef.current = Array.from(
                    document.querySelectorAll(
                        ids
                            .filter((id) => id.trim().length > 0)
                            .map(toIdQuerySelector)
                            .join(", ")
                    )
                ).reduce<Record<string, number>>((prev, curr) => {
                    prev[curr.id] = curr.getBoundingClientRect().top + scrollY - top;
                    return prev;
                }, {});
            } catch (e) {
                // TODO: sentry

                console.error("Error measuring table of contents", e);
            }
        });

        take();
    }, [ids, root, take, updateScrollPaddingTop]);

    useEffect(() => {
        if (!root) {
            return;
        }
        const observer = new ResizeObserver(measure);
        const headerElement = document.querySelector<HTMLElement>(HEADER_SELECTOR);
        const headerObserver =
            headerElement != null
                ? new ResizeObserver(() => {
                      updateScrollPaddingTop();
                  })
                : undefined;
        if (headerObserver && headerElement) {
            headerObserver.observe(headerElement);
        }
        updateScrollPaddingTop();

        // Throttle scroll handler with requestAnimationFrame to process once per frame
        const handleScroll = () => {
            if (rafIdRef.current == null) {
                rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = null;
                    take();
                });
            }
        };

        // Handle hash changes (e.g., when clicking TOC links or using browser back/forward)
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (!hash || !ids.includes(hash)) {
                return;
            }

            // Remeasure positions in case layout changed, then scroll to the target
            fastdom.measure(() => {
                const targetElement = document.getElementById(hash);
                if (!targetElement) {
                    return;
                }

                // Remeasure positions before scrolling
                const scrollY = root instanceof Document ? window.scrollY : root.scrollTop;
                const top = root instanceof Document ? 0 : root.getBoundingClientRect().top;
                try {
                    idToYRef.current = Array.from(
                        document.querySelectorAll(
                            ids
                                .filter((id) => id.trim().length > 0)
                                .map(toIdQuerySelector)
                                .join(", ")
                        )
                    ).reduce<Record<string, number>>((prev, curr) => {
                        prev[curr.id] = curr.getBoundingClientRect().top + scrollY - top;
                        return prev;
                    }, {});
                } catch (e) {
                    console.error("Error measuring table of contents on hash change", e);
                }

                // Scroll to the target element within the correct scroll container
                fastdom.mutate(() => {
                    if (root instanceof Document) {
                        targetElement.scrollIntoView({ behavior: "instant" });
                    } else {
                        // For custom scroll containers, calculate the scroll position
                        const containerRect = root.getBoundingClientRect();
                        const targetRect = targetElement.getBoundingClientRect();
                        const scrollTop = root.scrollTop + targetRect.top - containerRect.top;
                        root.scrollTo({ top: scrollTop, behavior: "instant" });
                    }
                });

                // Update active ID after scroll
                requestAnimationFrame(() => {
                    take();
                });
            });
        };

        // Use throttled handler for scroll events (reads cached positions) instead of 'measure' (expensive DOM queries)
        root.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("hashchange", handleHashChange);
        observer.observe(root instanceof Document ? document.body : root);
        window.addEventListener("resize", measure);

        // Measure positions on initial mount
        measure();

        // Handle initial hash on page load (browser auto-scroll may not work with custom scroll containers)
        const initialHash = window.location.hash.slice(1);
        if (initialHash && ids.includes(initialHash)) {
            // Wait for measurement to complete, then scroll to hash
            requestAnimationFrame(() => {
                handleHashChange();
            });
        }

        return () => {
            observer.disconnect();
            if (headerObserver && headerElement) {
                headerObserver.disconnect();
            }
            root.removeEventListener("scroll", handleScroll);
            window.removeEventListener("hashchange", handleHashChange);
            window.removeEventListener("resize", measure);
            if (rafIdRef.current != null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [measure, take, root, ids, updateScrollPaddingTop]);

    return measure;
}
