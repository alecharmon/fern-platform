"use client";

import { useEffect, useRef } from "react";

const HIDDEN_SIDEBAR_CSS = (preserveToc: boolean) => `
    ${preserveToc ? "" : "#fern-toc,"}
    #fern-sidebar[data-state="sticky"],
    #fern-sidebar[data-state="fixed"],
    #fern-sidebar-spacer {
        visibility: hidden;
        width: 0;
        overflow: hidden;
        display: none;
    }
`;

/**
 * Hides the sidebar, TOC, and sidebar spacer elements.
 *
 * Renders a <style> tag as JSX for SSR (avoiding layout shift on initial load),
 * then on the client swaps to a useEffect-managed <style> in document.head
 * that is properly cleaned up when Activity deactivates the route.
 *
 * With Next.js 16's cacheComponents (which wraps routes in <Activity> components),
 * navigating away from a page does NOT unmount it — it's kept alive but hidden
 * via `display: none`. A <style> tag rendered as JSX persists in the DOM and
 * continues to hide the sidebar even after navigating to a page that should
 * show it, since CSS <style> tags apply globally regardless of their parent's
 * display state.
 *
 * The fix:
 * 1. Render <style> as JSX for SSR (no layout shift on initial load)
 * 2. On client mount (useEffect), inject an equivalent <style> into <head>
 *    and disable the JSX <style> (so only the head style is active)
 * 3. On cleanup (Activity deactivation or unmount), remove the head <style>
 *    — the JSX style remains disabled, so sidebar becomes visible
 * 4. On re-activation, the effect re-runs: inject head style, disable JSX style
 */
export function HiddenSidebar({ preserveToc = false }: { preserveToc?: boolean }) {
    const styleRef = useRef<HTMLStyleElement>(null);

    useEffect(() => {
        const css = HIDDEN_SIDEBAR_CSS(preserveToc);

        // Inject a style into <head> that we fully control via useEffect lifecycle.
        const headStyle = document.createElement("style");
        headStyle.setAttribute("data-hidden-sidebar", "");
        headStyle.textContent = css;
        document.head.appendChild(headStyle);

        // Disable the JSX-rendered style so we don't have duplicate rules.
        // The JSX style only serves as an SSR placeholder to prevent layout shift.
        if (styleRef.current) {
            styleRef.current.disabled = true;
        }

        return () => {
            // Remove the head style — sidebar becomes visible on the new page.
            // The JSX style stays disabled, so it won't re-hide the sidebar.
            headStyle.remove();
        };
    }, [preserveToc]);

    return (
        <style ref={styleRef}>{`
        ${preserveToc ? "" : "#fern-toc,"}
        #fern-sidebar[data-state="sticky"],
        #fern-sidebar[data-state="fixed"],
        #fern-sidebar-spacer {
          visibility: hidden;
          width: 0;
          overflow: hidden;
          display: none;
        }
      `}</style>
    );
}
