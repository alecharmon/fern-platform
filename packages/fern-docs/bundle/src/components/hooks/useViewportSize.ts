import { useIsomorphicLayoutEffect } from "@fern-ui/react-commons";
import { useEffect, useState } from "react";

export function useViewportSize(): { width: number; height: number } {
    const [width, setViewportWidth] = useState<number>(0);
    const [height, setViewportHeight] = useState<number>(0);

    useEffect(() => {
        const handleResize = () => {
            setViewportHeight(window.innerHeight);
            setViewportWidth(window.innerWidth);
        };

        handleResize();

        window.addEventListener("resize", handleResize, { passive: true });
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    return { width, height };
}

export function useHeaderHeight(): number {
    const [headerHeight, setHeaderHeight] = useState<number>(0);
    useIsomorphicLayoutEffect(() => {
        const header = document.getElementById("fern-header");
        if (header) {
            setHeaderHeight(header.clientHeight);
        }
        const resizeObserver = new ResizeObserver(() => {
            const header = document.getElementById("fern-header");
            if (header) {
                setHeaderHeight(header.clientHeight);
            }
        });
        resizeObserver.observe(document.body);
        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return headerHeight;
}
