/** biome-ignore-all lint/correctness/useHookAtTopLevel: hook is disabled in SSG mode */

import fastdom from "fastdom";
import { type RefObject, useEffect, useRef } from "react";
import { noop } from "ts-essentials";

export function useResizeObserver(
    ref: RefObject<HTMLElement | null>,
    measure: (entries: ResizeObserverEntry[]) => void
): void {
    // ResizeObserver is not supported in SSG, so this hook should be disabled on the server-side
    if (typeof ResizeObserver === "undefined") {
        return;
    }

    // use fastdom to batch measure calls and avoid layout thrashing
    const cancelMeasure = useRef<() => void>(noop);

    // this should be a stable reference
    const resizeObserver = useRef(
        new ResizeObserver((entries: ResizeObserverEntry[]) => {
            fastdom.clear(cancelMeasure.current);
            cancelMeasure.current = fastdom.measure(() => measure(entries));
        })
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run on mount
    useEffect(() => {
        if (ref.current) {
            resizeObserver.current.disconnect();
            resizeObserver.current.observe(ref.current);
        }

        // cleanup on unmount
        return () => {
            resizeObserver.current.disconnect();
        };
    }, []);
}
