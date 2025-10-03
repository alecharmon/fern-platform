import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useOrgNameFromPathname } from "./useOrgNameFromPathname";

export function usePathnameWithoutOrgName(): `/${string}` {
    const pathname = usePathname();
    const orgName = useOrgNameFromPathname();

    return useMemo(() => pathname.replace(new RegExp(`^/${orgName}`), "") as `/${string}`, [orgName, pathname]);
}
