import { atom, useAtom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const isSidebarCollapsedAtom = atomWithStorage("fern-sidebar-collapsed", false);

export const useIsSidebarCollapsed = () => {
    return useAtom(isSidebarCollapsedAtom);
};

export const useToggleSidebarCollapse = () => {
    const setIsSidebarCollapsed = useSetAtom(isSidebarCollapsedAtom);
    return () => setIsSidebarCollapsed((prev) => !prev);
};

export const useSetSidebarCollapsed = () => {
    return useSetAtom(isSidebarCollapsedAtom);
};
