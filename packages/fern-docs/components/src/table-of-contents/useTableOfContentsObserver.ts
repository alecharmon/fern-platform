import fastdom from "fastdom";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { useCallbackOne } from "use-memo-one";

import { SCROLL_BODY_ATOM } from "../state/viewport";

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
 * @param setActiveId the function to call when an observed element (and its immediate siblings below) is visible above 40% of the viewport height
 * @returns a function to call to trigger another measurement (to be called between page views)
 */
export function useTableOfContentsObserver(ids: string[], setActiveId: (id: string | undefined) => void): () => void {
    const idToYRef = useRef<Record<string, number>>({});
    const root = useAtomValue(SCROLL_BODY_ATOM);
    const rafIdRef = useRef<number | null>(null);

    /**
     * on every scroll event, measure the top Y position of each element and determine
     * which is the last element that is visible above 40% of the viewport height
     */
    const take = useCallbackOne(() => {
        if (!root) {
            setActiveId(undefined);
            return;
        }
        fastdom.measure(() => {
            const scrollY = root instanceof Document ? window.scrollY : root.scrollTop;
            const scrollHeight = root instanceof Document ? document.body.scrollHeight : root.scrollHeight;
            const clientHeight = root instanceof Document ? window.innerHeight : root.clientHeight;
            const rootTop = root instanceof Document ? 0 : root.getBoundingClientRect().top;
            const intersectionTop = scrollY + rootTop;
            const intersectionBottom = scrollY + rootTop + clientHeight;

            // when the user scrolls to the very top of the page, set the anchorInView to the first anchor
            if (scrollY === 0) {
                const firstAnchor = ids[0];
                if (firstAnchor) {
                    setActiveId(firstAnchor);
                }
                return;
            }

            // when the user scrolls to the very bottom of the page, set the anchorInView to the last anchor
            const lastAnchor = ids[ids.length - 1];
            if (scrollHeight - clientHeight <= scrollY) {
                if (lastAnchor) {
                    setActiveId(lastAnchor);
                }
                return;
            }

            let activeId: string | undefined;
            for (const id of ids) {
                const y = idToYRef.current[id];
                if (y == null) {
                    continue;
                }

                if (y > intersectionBottom) {
                    break;
                }

                if (y < intersectionTop + clientHeight * 0.4) {
                    // if the element is visible above 40% of the viewport height, set it as the activeId
                    activeId = id;
                }
            }

            setActiveId(activeId);
        });
    }, [ids, root, setActiveId]);

    /**
     * when the page is mounted or resized, measure the top Y position of each element
     */
    const measure = useCallbackOne(() => {
        if (!root) {
            return;
        }
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
    }, [ids, root, take]);

    useEffect(() => {
        if (!root) {
            return;
        }
        const observer = new ResizeObserver(measure);

        // Throttle scroll handler with requestAnimationFrame to process once per frame
        const handleScroll = () => {
            if (rafIdRef.current == null) {
                rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = null;
                    take();
                });
            }
        };

        // Handle hash changes (e.g., when clicking TOC links) to scroll to anchors within the correct scroll container
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
                        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
                    } else {
                        // For custom scroll containers, calculate the scroll position
                        const containerRect = root.getBoundingClientRect();
                        const targetRect = targetElement.getBoundingClientRect();
                        const scrollTop = root.scrollTop + targetRect.top - containerRect.top;
                        root.scrollTo({ top: scrollTop, behavior: "smooth" });
                    }
                });
            });
        };

        // Use throttled handler for scroll events (reads cached positions) instead of 'measure' (expensive DOM queries)
        root.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("hashchange", handleHashChange);
        observer.observe(root instanceof Document ? document.body : root);
        window.addEventListener("resize", measure);

        // Also handle initial hash on mount
        if (window.location.hash) {
            handleHashChange();
        }

        return () => {
            observer.disconnect();
            root.removeEventListener("scroll", handleScroll);
            window.removeEventListener("hashchange", handleHashChange);
            window.removeEventListener("resize", measure);
            if (rafIdRef.current != null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [measure, take, root, ids]);

    return measure;
}
