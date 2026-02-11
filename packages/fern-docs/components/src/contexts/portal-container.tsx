"use client";

import { createContext, useContext } from "react";

const PortalContainerContext = createContext<HTMLElement | undefined>(undefined);

export const usePortalContainer = (): HTMLElement | undefined => {
    return useContext(PortalContainerContext);
};

export const PortalContainerProvider = PortalContainerContext.Provider;
