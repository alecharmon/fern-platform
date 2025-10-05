import yaml from "js-yaml";

import type { DocsConfig, StoredNavigationData } from "./types";

export function buildDocsYmlWithUpdates(navigationData: StoredNavigationData): string {
    const { baseContent, pendingUpdates } = navigationData.docsYmlState;

    // If there are no pending updates, return the base content
    if (Object.keys(pendingUpdates).length === 0) {
        return baseContent;
    }

    // If there are pending updates but no base content, we cannot safely apply updates
    if (!baseContent) {
        throw new Error(
            "Cannot build docs.yml: base content not available but pending updates exist. Please ensure docs.yml is loaded before committing."
        );
    }

    try {
        const docsConfig = yaml.load(baseContent) as DocsConfig;
        docsConfig.navigation ??= [];

        const sortedUpdates = Object.values(pendingUpdates).sort((a, b) => a.createdAt - b.createdAt);

        for (const update of sortedUpdates) {
            if (update.operation === "add") {
                applyAddOperation(docsConfig, update);
            } else if (update.operation === "remove") {
                applyRemoveOperation(docsConfig, update);
            }
        }

        return yaml.dump(docsConfig, { lineWidth: -1 });
    } catch (error) {
        console.error("Error generating docs.yml content:", error);
        return baseContent;
    }
}

function applyAddOperation(
    docsConfig: DocsConfig,
    update: {
        sectionTitle: string | null;
        tabSlug?: string;
        pageEntry: { page: string; path: string };
    }
) {
    const { sectionTitle, tabSlug, pageEntry } = update;

    if (!docsConfig.navigation) {
        docsConfig.navigation = [];
    }

    // Handle tabbed navigation
    if (tabSlug) {
        let tab = docsConfig.navigation.find((item) => item.tab === tabSlug);

        if (!tab) {
            tab = { tab: tabSlug, layout: [] };
            docsConfig.navigation.push(tab);
        }

        tab.layout ??= [];

        // If sectionTitle is null, add page directly to tab layout
        if (sectionTitle == null) {
            const pageExists = tab.layout.some((item) => item.page === pageEntry.page || item.path === pageEntry.path);

            if (!pageExists) {
                tab.layout.unshift({
                    page: pageEntry.page,
                    path: pageEntry.path
                });
            }
            return;
        }

        // Handle named sections within tab layout
        let section = tab.layout.find((item) => item.section === sectionTitle);

        if (!section) {
            section = { section: sectionTitle, contents: [] };
            tab.layout.push(section);
        }

        section.contents ??= [];

        const pageExists = section.contents.some(
            (item) => item.page === pageEntry.page || item.path === pageEntry.path
        );

        if (!pageExists) {
            section.contents.unshift({
                page: pageEntry.page,
                path: pageEntry.path
            });
        }
        return;
    }

    // Handle non-tabbed navigation (legacy)

    // If sectionTitle is null, add page directly to root navigation
    if (sectionTitle == null) {
        const pageExists = docsConfig.navigation.some(
            (item) => item.page === pageEntry.page || item.path === pageEntry.path
        );

        if (!pageExists) {
            docsConfig.navigation.unshift({
                page: pageEntry.page,
                path: pageEntry.path
            });
        }
        return;
    }

    // Handle named sections in non-tabbed navigation
    let section = docsConfig.navigation.find((item) => item.section === sectionTitle || item.tab === sectionTitle);

    if (!section) {
        section = { section: sectionTitle, contents: [] };
        docsConfig.navigation.push(section);
    }

    section.contents ??= [];

    const pageExists = section.contents.some((item) => item.page === pageEntry.page || item.path === pageEntry.path);

    if (!pageExists) {
        section.contents.unshift({
            page: pageEntry.page,
            path: pageEntry.path
        });
    }
}

function applyRemoveOperation(docsConfig: DocsConfig, update: { pageEntry: { path: string } }) {
    const pagePathToRemove = update.pageEntry.path;

    if (docsConfig.navigation) {
        docsConfig.navigation.forEach((section) => {
            if (section.contents) {
                section.contents = section.contents.filter((item) => item.path !== pagePathToRemove);
            }
        });
    }
}
