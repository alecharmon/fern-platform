"use client";

import { ReactNode } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";

import { SidebarClientNavigationChild } from "./SidebarClientNavigationChild";
import { useSidebarClientNavigation } from "./SidebarClientNavigationProvider";

interface SidebarClientNavigationChildInjectorProps {
  childDepth: number;
  parentNodeId: NodeId;
}

export function SidebarClientNavigationChildInjector({
  childDepth,
  parentNodeId,
}: SidebarClientNavigationChildInjectorProps): ReactNode {
  const { clientNodes } = useSidebarClientNavigation();
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
