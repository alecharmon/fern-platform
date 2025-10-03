"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useUrlParams } from "@/hooks/use-url-params";

export function PlaygroundKeyboardTrigger() {
    const router = useRouter();
    const { urlHasParam, addUrlParamToPathname, removeUrlParamFromPathname } = useUrlParams();
    const pathname = usePathname();

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // Check for Ctrl + ` (backtick)
            if (e.ctrlKey && e.key === "`") {
                e.preventDefault();
                router.replace(
                    urlHasParam("explorer")
                        ? removeUrlParamFromPathname("explorer")
                        : addUrlParamToPathname("explorer", "true"),
                    { scroll: false }
                );
            }
        },
        [router, urlHasParam, addUrlParamToPathname, removeUrlParamFromPathname]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown, pathname]);

    return null;
}
