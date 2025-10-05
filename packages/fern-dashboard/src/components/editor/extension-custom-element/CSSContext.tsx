import React, { type ReactNode, createContext, useContext } from "react";

interface CSSConfig {
    inline?: string[];
}

const CSSContext = createContext<CSSConfig | undefined>(undefined);

export const CSSProvider = ({ children, cssConfig }: { children: ReactNode; cssConfig?: CSSConfig }) => {
    return <CSSContext.Provider value={cssConfig}>{children}</CSSContext.Provider>;
};

export const useCSS = () => {
    const context = useContext(CSSContext);
    if (context === undefined) {
        return { inline: [] };
    }
    return context;
};
