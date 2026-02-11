"use client";

import { PortalContainerProvider } from "@fern-docs/components/contexts/portal-container";
import { type PropsWithChildren, type ReactElement, useCallback, useState } from "react";

export function PreviewContainerProvider({ children }: PropsWithChildren): ReactElement {
    const [container, setContainer] = useState<HTMLElement | null>(null);

    const callbackRef = useCallback((node: HTMLDivElement | null) => {
        setContainer(node);
    }, []);

    return (
        <div id="preview-container" ref={callbackRef}>
            <PortalContainerProvider value={container ?? undefined}>{children}</PortalContainerProvider>
        </div>
    );
}
