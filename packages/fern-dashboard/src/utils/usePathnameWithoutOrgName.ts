import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useOrgNameFromPathname } from "./useOrgNameFromPathname";

// Cache for org name regex patterns to avoid recompilation
const orgRegexCache = new Map<string, RegExp>();

function getOrgRegex(orgName: string): RegExp {
    let regex = orgRegexCache.get(orgName);
    if (!regex) {
        regex = new RegExp(`^/${orgName}`);
        orgRegexCache.set(orgName, regex);
    }
    return regex;
}

export function usePathnameWithoutOrgName(): `/${string}` {
    const pathname = usePathname();
    const orgName = useOrgNameFromPathname();

    return useMemo(() => pathname.replace(getOrgRegex(orgName), "") as `/${string}`, [orgName, pathname]);
}
