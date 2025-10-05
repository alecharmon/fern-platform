import type { FernNavigation } from "@fern-api/fdr-sdk";

export const getIsSingleOverviewPage = (found: FernNavigation.utils.Node.Found) => {
    let isSingleOverviewPage = false;
    if (found.sidebar != null && found.sidebar.children.length <= 1 && found.node.type === "page") {
        // check if there is only one page in the sidebar

        if (found.sidebar.children.length <= 1) {
            let current: FernNavigation.NavigationNode | undefined = found.sidebar.children[0];
            isSingleOverviewPage = true;

            while (current && "children" in current) {
                if (current.children.length > 1) {
                    isSingleOverviewPage = false;
                    break;
                }
                current = current.children[0];
            }
        }
    }
    return isSingleOverviewPage;
};

export const getIsSidebarFixed = (config: any) => {
    return config.layout?.disableHeader || config.layout?.tabsPlacement === "SIDEBAR" || !config.layout;
};
