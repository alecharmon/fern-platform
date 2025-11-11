import { ROOT_SLUG_ALIAS } from "@fern-docs/components/navigation";

export const getInterceptedLink = (
    event: MouseEvent,
    metadata: {
        orgName: string;
        docsUrl: string;
        branch: string;
        basePath?: string;
    }
) => {
    const target = event.target as HTMLElement;
    const link = target.closest("a");

    if (!link) {
        return;
    }

    const href = link.getAttribute("href");
    if (!href) {
        return;
    }

    const { orgName, docsUrl, branch, basePath } = metadata;

    // Skip external links, anchors
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) {
        return;
    }

    // If the link is already an editor link, check if it has the correct branch
    if (href.includes("/editor/")) {
        const expectedPrefix = `/${orgName}/editor/${docsUrl}/${branch}/`;
        // If it already has the correct branch, don't intercept
        if (href.startsWith(expectedPrefix)) {
            return;
        }

        // Otherwise, we need to fix the link by inserting the branch
        // Pattern: /orgName/editor/docsUrl/...slug (missing branch)
        const editorPathMatch = href.match(/^\/([^/]+)\/editor\/([^/]+)\/(.+)$/);
        if (editorPathMatch) {
            const [, , , slugPart] = editorPathMatch;
            event.preventDefault();
            return `/${orgName}/editor/${docsUrl}/${branch}/${slugPart}`;
        }

        // If we can't parse it, don't intercept
        return;
    }

    // Prevent default navigation
    event.preventDefault();

    // If href is relative (starts with ./ or ../), resolve it against the current path using browser's URL API
    let resolvedHref: string;
    if (href.startsWith("./") || href.startsWith("../")) {
        // Use the browser's URL API to resolve relative paths
        // This handles all edge cases like ../../, ./, etc.
        try {
            const currentPath = window.location.pathname;
            // Get just the current slug portion (everything after branch)
            const editorPrefix = `/${orgName}/editor/${docsUrl}/${branch}/`;

            let basePathForResolve = currentPath;
            if (currentPath.startsWith(editorPrefix)) {
                // Extract just the slug part to use as base for resolution
                const currentSlug = currentPath.slice(editorPrefix.length);
                basePathForResolve = `/${currentSlug}`;
            }

            const resolved = new URL(href, `http://dummy.com${basePathForResolve}`);
            resolvedHref = cleanPath(resolved.pathname);
        } catch {
            // Fallback if URL API fails
            resolvedHref = cleanPath(href);
        }
    } else {
        // Convert to editor route
        resolvedHref = cleanPath(href);
    }

    const cleanBasePath = basePath ? cleanPath(basePath) : "";

    // If the link already matches or starts with the base path, use it as-is
    if (cleanBasePath && (resolvedHref === cleanBasePath || resolvedHref.startsWith(cleanBasePath + "/"))) {
        return `/${orgName}/editor/${docsUrl}/${branch}/${resolvedHref}`;
    }

    // Handle root path - forward to ROOT_SLUG_ALIAS
    if (cleanBasePath === "" && resolvedHref === "") {
        return `/${orgName}/editor/${docsUrl}/${branch}/${ROOT_SLUG_ALIAS}`;
    }

    // Otherwise, add the base path prefix
    const basePathPrefix = cleanBasePath ? `${cleanBasePath}/` : "";
    return `/${orgName}/editor/${docsUrl}/${branch}/${basePathPrefix}${resolvedHref}`;
};

const cleanPath = (path: string) => {
    return path.startsWith("/") ? path.slice(1) : path;
};
