"use client";

import { type ReactNode, createContext } from "react";

export const NoZoomContext = createContext<boolean>(false);

export function NoZoom({ children }: { children: ReactNode }) {
    return <NoZoomContext.Provider value={true}>{children}</NoZoomContext.Provider>;
}
