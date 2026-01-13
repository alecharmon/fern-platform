"use client";

import { useRouter } from "@bprogress/next/app";
import { useCallback, useEffect } from "react";

import { useEditorRouting } from "../../providers/EditorRoutingContext";
import { getInterceptedLink } from "./link-interceptor";

const DROPDOWN_SELECTORS = [
    '[data-testid="product-dropdown-content"]',
    '[data-testid="version-dropdown-content"]',
    ".fern-dropdown"
].join(",");

const EDITOR_SELECTORS = ".ProseMirror";

// Mobile sidebar is rendered via Portal outside #preview-container, so we need to intercept links there too
const MOBILE_SIDEBAR_SELECTOR = "#fern-sidebar[data-viewport='mobile']";

export function EditorLinkInterceptor() {
    const { orgName, docsUrl, branch, basePath } = useEditorRouting();
    const router = useRouter();

    const handleClick = useCallback(
        async (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const link = target.closest("a");

            if (!link) {
                return;
            }

            // Check if the click is within our target containers (preview, dropdowns, editor, or mobile sidebar)
            const isInTargetContainer =
                link.closest("#preview-container") ||
                link.closest(DROPDOWN_SELECTORS) ||
                link.closest(EDITOR_SELECTORS) ||
                link.closest(MOBILE_SIDEBAR_SELECTOR);

            if (isInTargetContainer) {
                const interceptedLink = getInterceptedLink(event, {
                    orgName,
                    docsUrl,
                    branch,
                    basePath
                });
                if (interceptedLink) {
                    router.push(interceptedLink);
                }
            }
        },
        [orgName, docsUrl, branch, basePath, router]
    );

    useEffect(() => {
        const handleClickFn = (event: MouseEvent) => {
            void handleClick(event);
        };

        // Single global event listener using capture phase for maximum efficiency
        document.addEventListener("click", handleClickFn, {
            capture: true,
            passive: false
        });

        return () => {
            document.removeEventListener("click", handleClickFn, {
                capture: true
            });
        };
    }, [handleClick]);

    return null;
}
