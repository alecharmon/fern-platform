"use client";

import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback } from "react";

const sidebarCollapsedAtom = atomWithStorage<boolean>("fern-dashboard-sidebar-collapsed", false);

export function useIsSidebarCollapsed() {
    return useAtom(sidebarCollapsedAtom);
}

export function useToggleSidebarCollapse() {
    const [, setIsCollapsed] = useAtom(sidebarCollapsedAtom);
    return useCallback(() => {
        setIsCollapsed((prev) => !prev);
    }, [setIsCollapsed]);
}
