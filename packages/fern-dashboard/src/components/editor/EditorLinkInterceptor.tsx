"use client";

import { useCallback, useEffect } from "react";

import { useRouter } from "@bprogress/next/app";

import { useEditorRouting } from "../../providers/EditorRoutingContext";
import { getInterceptedLink } from "./link-interceptor";

const DROPDOWN_SELECTORS = [
    '[data-testid="product-dropdown-content"]',
    '[data-testid="version-dropdown-content"]',
    ".fern-dropdown"
].join(",");

export function EditorLinkInterceptor() {
    const { orgName, docsUrl, branch } = useEditorRouting();
    const router = useRouter();

    const handleClick = useCallback(
        async (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const link = target.closest("a");

            if (!link) return;

            // Check if the click is within our target containers
            const isInTargetContainer = link.closest("#preview-container") || link.closest(DROPDOWN_SELECTORS);

            if (isInTargetContainer) {
                const interceptedLink = getInterceptedLink(event, {
                    orgName,
                    docsUrl,
                    branch
                });
                if (interceptedLink) {
                    router.push(interceptedLink);
                }
            }
        },
        [orgName, docsUrl, branch, router]
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
