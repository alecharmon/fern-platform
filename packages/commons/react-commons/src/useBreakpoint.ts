import React from "react";

import { isomorphicRequestAnimationFrame } from "./request-callback";
import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

const ContainerRefContext = React.createContext<React.RefObject<HTMLElement | null> | null>(null);

export const ContainerRefProvider = ContainerRefContext.Provider;

export function useContainerRef(): React.RefObject<HTMLElement | null> | null {
    return React.useContext(ContainerRefContext);
}

function useObservedContainerWidth(containerRef: React.RefObject<HTMLElement | null> | null): number | null {
    const [width, setWidth] = React.useState<number | null>(null);

    React.useEffect(() => {
        const element = containerRef?.current;
        if (!element) {
            setWidth(null);
            return;
        }

        setWidth(element.offsetWidth);

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, [containerRef]);

    return width;
}

export function useMinWidth(breakpoint: number): boolean {
    const [largerThanBreakpoint, setLargerThanBreakpoint] = React.useState<boolean>(() =>
        typeof window === "undefined" ? true : window.innerWidth >= breakpoint
    );

    useIsomorphicLayoutEffect(() => {
        const cancelAnimationFrame = isomorphicRequestAnimationFrame(() => {
            setLargerThanBreakpoint(window.innerWidth >= breakpoint);
        });

        const mql = window.matchMedia(`(min-width: ${breakpoint}px)`);
        const onChange = (e: MediaQueryListEvent) => {
            setLargerThanBreakpoint(e.matches);
        };

        mql.addEventListener("change", onChange);
        return () => {
            cancelAnimationFrame();
            mql.removeEventListener("change", onChange);
        };
    }, [breakpoint]);

    return !!largerThanBreakpoint;
}

// In Docs: no ContainerRefProvider exists, so this falls through to window.innerWidth via matchMedia.
// In Editor: ContainerRefProvider wraps the preview panel, so this uses ResizeObserver on the
// container element to detect mobile based on panel width rather than viewport width.
export function useIsMobile(): boolean {
    const containerRef = useContainerRef();
    const containerWidth = useObservedContainerWidth(containerRef);
    const windowIsMobile = !useMinWidth(MOBILE_BREAKPOINT);

    if (containerRef && containerWidth !== null) {
        return containerWidth < MOBILE_BREAKPOINT;
    }

    return windowIsMobile;
}

// In Docs: no ContainerRefProvider exists, so this falls through to window.innerWidth via matchMedia
// (adjusted for the ask-ai side panel width).
// In Editor: ContainerRefProvider wraps the preview panel, so this uses ResizeObserver on the
// container element to detect desktop based on panel width rather than viewport width.
export function useIsDesktop(): boolean {
    const containerRef = useContainerRef();
    const containerWidth = useObservedContainerWidth(containerRef);

    const [sidePanelWidth, setSidePanelWidth] = React.useState(0);

    React.useEffect(() => {
        if (typeof window !== "undefined") {
            const checkPanelWidth = () => {
                const panelWidth = getComputedStyle(document.documentElement).getPropertyValue("--ask-ai-panel-width");

                setSidePanelWidth(parseInt(panelWidth) || 0);
            };

            checkPanelWidth();
            const observer = new MutationObserver(checkPanelWidth);
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["style"]
            });

            return () => observer.disconnect();
        }
        return undefined;
    }, []);

    const windowIsDesktop = useMinWidth(DESKTOP_BREAKPOINT + sidePanelWidth);

    if (containerRef && containerWidth !== null) {
        return containerWidth >= DESKTOP_BREAKPOINT;
    }

    return windowIsDesktop;
}
