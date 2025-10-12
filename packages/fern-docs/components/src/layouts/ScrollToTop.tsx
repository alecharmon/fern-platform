"use client";

import { isExplorerRoute } from "@fern-api/docs-utils";
import { usePrevious } from "@fern-ui/react-commons";
import React from "react";

import { useCurrentPathname } from "../hooks/use-current-pathname";
import { scrollToRoute } from "../util/anchor";

export function ScrollToTop() {
    const pathname = useCurrentPathname();
    const previousPathname = usePrevious(pathname);
    React.useEffect(() => {
        if (isExplorerRoute(pathname) || isExplorerRoute(previousPathname)) {
            // don't scroll to top if the route is actually the same (minus the explorer route)
            return;
        }

        if (!scrollToRoute(`${pathname}${window.location.hash}`)) {
            window.scrollTo(0, 0);
        }
    }, [pathname, previousPathname]);
    return null;
}
