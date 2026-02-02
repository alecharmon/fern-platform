import { useIsomorphicLayoutEffect } from "@fern-ui/react-commons";
import { usePathname, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect } from "react";

export function useCurrentAnchor() {
    const [anchor, setAnchor] = React.useState<string>("");
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const updateAnchor = useCallback(() => {
        const hash = window.location.hash.slice(1);
        setAnchor(hash);
    }, []);

    // Update anchor when pathname or searchParams change
    useIsomorphicLayoutEffect(() => {
        updateAnchor();
    }, [pathname, searchParams, updateAnchor]);

    // Listen for hashchange events to detect when only the hash changes
    useEffect(() => {
        window.addEventListener("hashchange", updateAnchor);
        return () => {
            window.removeEventListener("hashchange", updateAnchor);
        };
    }, [updateAnchor]);

    return anchor;
}
