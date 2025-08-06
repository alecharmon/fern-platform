"use client";

import { ReactNode, createContext, useContext, useState } from "react";

export const DevModeContext = createContext<{
  panelOpen: boolean;
  setPanelOpen: (panelOpen: boolean) => void;
}>({
  panelOpen: false,
  setPanelOpen: (_panelOpen: boolean) => {
    return;
  },
});

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpenStore] = useState<boolean>(false);

  function setPanelOpen(panelOpen: boolean) {
    setPanelOpenStore(panelOpen);
  }

  return (
    <DevModeContext.Provider value={{ panelOpen, setPanelOpen }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  return useContext(DevModeContext);
}
