export const getInterceptedLink = (
  event: MouseEvent,
  metadata: {
    orgName: string;
    docsUrl: string;
    branch: string;
  }
) => {
  const target = event.target as HTMLElement;
  const link = target.closest("a");

  if (!link) return;

  const href = link.getAttribute("href");
  if (!href) return;

  // Skip external links, anchors, and already modified links
  if (
    href.startsWith("http") ||
    href.startsWith("mailto:") ||
    href.startsWith("#") ||
    href.includes("/editor/")
  ) {
    return;
  }

  // Prevent default navigation
  event.preventDefault();

  // Convert to editor route
  const cleanHref = href.startsWith("/") ? href.slice(1) : href;

  const editorHref = `/${metadata.orgName}/editor/${metadata.docsUrl}/${metadata.branch}/${cleanHref}`;

  return editorHref;
};
