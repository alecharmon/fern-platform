"use client";

import { PortalContainerProvider } from "@fern-docs/components/contexts/portal-container";
import { type PropsWithChildren, type ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { useThemingPanel } from "@/providers/ThemingPanelProvider";
import { CSS_VAR_MAP } from "./docs-yml-colors";

export function PreviewContainerProvider({ children }: PropsWithChildren): ReactElement {
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { colorOverrides } = useThemingPanel();

    const callbackRef = useCallback((node: HTMLDivElement | null) => {
        containerRef.current = node;
        setContainer(node);
    }, []);

    // Apply color overrides as inline CSS custom properties on the container.
    // Inline styles have the highest CSS specificity, so they override any
    // server-rendered GlobalStyles CSS variables regardless of caching.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) {
            return;
        }

        if (!colorOverrides) {
            for (const { varName } of CSS_VAR_MAP) {
                el.style.removeProperty(varName);
            }
            return;
        }

        const isDark = document.documentElement.classList.contains("dark");

        for (const { key, varName } of CSS_VAR_MAP) {
            const value = isDark ? colorOverrides[key].dark : colorOverrides[key].light;
            if (value) {
                el.style.setProperty(varName, value);
            } else {
                el.style.removeProperty(varName);
            }
        }
    }, [colorOverrides]);

    return (
        <div id="preview-container" ref={callbackRef}>
            <PortalContainerProvider value={container ?? undefined}>{children}</PortalContainerProvider>
        </div>
    );
}
