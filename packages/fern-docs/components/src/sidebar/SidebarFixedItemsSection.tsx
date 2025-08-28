"use client";

import { Fragment } from "react";

import { useIsMobile } from "@fern-ui/react-commons";

import { cn } from "../cn";

export function SidebarFixedItemsSection({
  logo,
  versionSelect,
  productSelect,
  className,
  showSearchBar,
  showHeaderInSidebar,
  searchBar,
}: {
  logo: React.ReactNode;
  versionSelect: React.ReactNode;
  productSelect: React.ReactNode;
  showBorder?: boolean;
  showSearchBar?: boolean;
  searchBar?: React.ReactNode;
  showHeaderInSidebar?: boolean;
  className?: string;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return null;
  }
  if (!showHeaderInSidebar && !showSearchBar) {
    return null;
  }
  return (
    <div className={cn("flex flex-col px-4 pt-2 lg:pl-5", className)}>
      {showHeaderInSidebar && (
        <>
          <div className="fern-sidebar-header">
            <div className="relative flex h-full min-w-fit flex-1 shrink-0 items-center gap-2 py-1">
              <div className="flex items-center gap-2">{logo}</div>
            </div>
          </div>
          <Fragment key="product-select">{productSelect}</Fragment>
          <Fragment key="version-select">{versionSelect}</Fragment>
        </>
      )}
      {searchBar}
    </div>
  );
}
