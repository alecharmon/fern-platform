import type { LibraryDefinition, ModuleDefinition } from "../ir/types";
import type { StoredNavigation, StoredNavigationChild } from "../ResultStorage";
import type { GeneratedPage } from "./MarkdownGenerator";

export interface NavigationConfig {
    title: string;
    slug: string;
}

/**
 * Builds navigation from IR and generated pages.
 */
export class NavigationBuilder {
    buildNavigation(library: LibraryDefinition, pages: GeneratedPage[], config: NavigationConfig): StoredNavigation {
        const pageMap = new Map(pages.map((p) => [p.slug, p]));
        const children: StoredNavigationChild[] = [];

        // Overview page
        const overview = pageMap.get(config.slug);
        if (overview) {
            children.push({
                type: "page",
                title: "Overview",
                slug: "overview",
                pageId: overview.pageId
            });
        }

        // Module sections
        for (const module of library.modules) {
            children.push(this.buildModuleNav(module, config.slug, pageMap));
        }

        return { title: config.title, slug: config.slug, children };
    }

    private buildModuleNav(
        module: ModuleDefinition,
        baseSlug: string,
        pageMap: Map<string, GeneratedPage>
    ): StoredNavigationChild {
        const moduleSlug = `${baseSlug}/${module.name}`;
        const children: StoredNavigationChild[] = [];

        // Module overview
        const modulePage = pageMap.get(moduleSlug);
        if (modulePage) {
            children.push({
                type: "page",
                title: "Overview",
                slug: "overview",
                pageId: modulePage.pageId
            });
        }

        // Class pages
        for (const member of module.members) {
            if (member.kind === "class") {
                const classSlug = `${moduleSlug}/${member.name.toLowerCase()}`;
                const classPage = pageMap.get(classSlug);
                if (classPage) {
                    children.push({
                        type: "page",
                        title: member.name,
                        slug: member.name.toLowerCase(),
                        pageId: classPage.pageId
                    });
                }
            }
        }

        return { type: "section", title: module.name, slug: module.name, children };
    }
}
