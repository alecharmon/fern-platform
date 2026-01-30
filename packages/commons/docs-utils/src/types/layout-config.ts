export interface FernLayoutConfig {
    logoHeight: number;
    sidebarWidth: number;
    headerHeight: number;
    pageWidth: number | undefined;
    contentWidth: number;
    tabsPlacement: "SIDEBAR" | "HEADER";
    searchbarPlacement: "SIDEBAR" | "HEADER" | "HEADER_TABS";
    switcherPlacement: "SIDEBAR" | "HEADER";
    isHeaderDisabled: boolean;
    hideNavLinks: boolean;
    hideFeedback: boolean;
}
