"use client";

import { createContext, type ReactNode } from "react";

export const NoZoomContext = createContext<boolean>(false);

export function NoZoom({ children }: { children: ReactNode }) {
    return <NoZoomContext.Provider value={true}>{children}</NoZoomContext.Provider>;
}
