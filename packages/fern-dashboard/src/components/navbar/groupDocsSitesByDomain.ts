import type { DocsSiteData } from "./DocsNavbarItems";

export interface BasepathTreeNode {
    /** The segment name shown in the sidebar (e.g. "nemo", "nemo-rl") */
    segment: string;
    /** The full basepath (e.g. "/nemo/nemo-rl") — only set if this node maps to an actual site */
    site: DocsSiteData | undefined;
    children: BasepathTreeNode[];
}

export interface DocsSiteGroup {
    domain: string;
    /** If the group has only one site with no basepath, it's a regular (non-multi-repo) site */
    isMultiRepo: boolean;
    sites: DocsSiteData[];
    /** The root site (no basepath / bare domain), if it exists */
    rootSite: DocsSiteData | undefined;
    /** Hierarchical tree of basepath children (excludes root site) */
    tree: BasepathTreeNode[];
}

/**
 * Builds a hierarchical tree from flat basepath strings, similar to how IDEs show folder structures.
 * Only creates nesting when a parent path also exists as a site.
 * e.g. if sites have /nemo and /nemo/nemo-rl, /nemo-rl is nested under /nemo.
 * But if only /nemo/nemo-rl exists (no /nemo site), it stays flat as "/nemo/nemo-rl".
 */
function buildBasepathTree(sites: DocsSiteData[]): { rootSite: DocsSiteData | undefined; tree: BasepathTreeNode[] } {
    // Normalize a basepath: strip trailing slashes, ensure leading slash
    const normalize = (bp: string | undefined): string => {
        if (bp == null || bp === "") {
            return "/";
        }
        const trimmed = bp.replace(/\/+$/, "") || "/";
        return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    };

    const isRoot = (bp: string): boolean => bp === "/";

    // Deduplicate sites by normalized basepath (FDR can return e.g. "/brev" and "/brev/" as separate sites)
    const siteByPath = new Map<string, DocsSiteData>();
    for (const site of sites) {
        const path = normalize(site.basepath);
        if (!siteByPath.has(path)) {
            siteByPath.set(path, site);
        }
    }

    // Identify root site
    const rootSite = siteByPath.get("/") ?? sites.find((s) => s.url === s.domain);

    // Collect non-root sites with their normalized basepaths
    const nonRootEntries: Array<{ path: string; site: DocsSiteData }> = [];
    for (const [path, site] of siteByPath) {
        if (site === rootSite || isRoot(path)) {
            continue;
        }
        nonRootEntries.push({ path, site });
    }

    // Sort by path length so parents come before children
    nonRootEntries.sort((a, b) => a.path.length - b.path.length);

    // Map from normalized basepath to its tree node
    const nodeMap = new Map<string, BasepathTreeNode>();
    const rootNodes: BasepathTreeNode[] = [];

    for (const { path, site } of nonRootEntries) {
        // Split into segments: "/nemo/nemo-rl" -> ["nemo", "nemo-rl"]
        const segments = path.slice(1).split("/");

        // Try to find the closest ancestor that exists as a site
        let placed = false;
        for (let i = segments.length - 1; i > 0; i--) {
            const parentPath = `/${segments.slice(0, i).join("/")}`;
            const parentNode = nodeMap.get(parentPath);
            if (parentNode != null) {
                const remainingSegment = segments.slice(i).join("/");
                const node: BasepathTreeNode = {
                    segment: remainingSegment,
                    site,
                    children: []
                };
                parentNode.children.push(node);
                nodeMap.set(path, node);
                placed = true;
                break;
            }
        }

        if (!placed) {
            const node: BasepathTreeNode = {
                segment: segments.join("/"),
                site,
                children: []
            };
            rootNodes.push(node);
            nodeMap.set(path, node);
        }
    }

    return { rootSite, tree: rootNodes };
}

/**
 * Groups docs sites by domain. Only domains confirmed as multi-repo (via Upstash basepath routes)
 * are grouped. All other domains remain ungrouped regardless of URL structure.
 *
 * @param multiRepoDomains - Set of domain strings confirmed to have basepath routes in Upstash
 */
export function groupDocsSitesByDomain(
    docsSitesData: DocsSiteData[],
    multiRepoDomains: ReadonlySet<string>
): DocsSiteGroup[] {
    const domainMap = new Map<string, DocsSiteData[]>();

    for (const site of docsSitesData) {
        const existing = domainMap.get(site.domain);
        if (existing != null) {
            existing.push(site);
        } else {
            domainMap.set(site.domain, [site]);
        }
    }

    const groups: DocsSiteGroup[] = [];
    for (const [domain, sites] of domainMap) {
        const isMultiRepo = multiRepoDomains.has(domain);
        const { rootSite, tree } = isMultiRepo ? buildBasepathTree(sites) : { rootSite: undefined, tree: [] };
        groups.push({ domain, isMultiRepo, sites, rootSite, tree });
    }

    return groups;
}
