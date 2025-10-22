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

    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;

    // Skip external links, anchors, and already modified links
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#") || href.includes("/editor/")) {
        return;
    }

    // Prevent default navigation
    event.preventDefault();

    // Convert to editor route
    const cleanHref = cleanPath(href);

    const { orgName, docsUrl, branch, basePath } = metadata;

    const cleanBasePath = basePath ? cleanPath(basePath) : "";

    // If the link already matches or starts with the base path, use it as-is
    if (cleanBasePath && (cleanHref === cleanBasePath || cleanHref.startsWith(cleanBasePath + "/"))) {
        return `/${orgName}/editor/${docsUrl}/${branch}/${cleanHref}`;
    }

    // Otherwise, add the base path prefix
    const basePathPrefix = cleanBasePath ? `${cleanBasePath}/` : "";
    return `/${orgName}/editor/${docsUrl}/${branch}/${basePathPrefix}${cleanHref}`;
};

const cleanPath = (path: string) => {
    return path.startsWith("/") ? path.slice(1) : path;
};
