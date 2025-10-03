"use client";

import { ReactNode, useEffect, useState } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";

import { useSafeNavigation } from "../../navigation";
import { SidebarClientNavigationChild } from "./SidebarClientNavigationChild";

interface SidebarClientNavigationChildInjectorProps {
    childDepth: number;
    parentNodeId: NodeId;
}

export function SidebarClientNavigationChildInjector({
    childDepth,
    parentNodeId
}: SidebarClientNavigationChildInjectorProps): ReactNode {
    const navigation = useSafeNavigation();
    const clientNodes = navigation?.clientNodes;
    const [isHydrated, setIsHydrated] = useState(false);

    // Prevent hydration mismatch by only rendering client nodes after hydration
    useEffect(() => {
        setIsHydrated(true);
    }, []);

    // Don't render client pages during SSR to avoid hydration mismatch
    if (!isHydrated) {
        return null;
    }

    const children = clientNodes?.[parentNodeId];

    return (
        <>
            {children?.map((child) => (
                <li key={child.id}>
                    <SidebarClientNavigationChild node={child} depth={childDepth} />
                </li>
            ))}
        </>
    );
}
