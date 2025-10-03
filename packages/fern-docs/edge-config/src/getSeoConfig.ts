import { isCustomDomain } from "@fern-api/docs-utils";

import { getEdge } from "./getEdge";
import { isLocal } from "./isLocal";

export async function getSeoDisabled(domain: string): Promise<boolean> {
    if (isLocal()) {
        return true;
    }

    const isSeoEnabled = (await getEdge<string[]>("seo-enabled")) ?? [];
    if (isSeoEnabled.includes(domain)) {
        return false;
    }

    if (!isCustomDomain(domain)) {
        return true;
    }
    const isDisabled = (await getEdge<string[]>("seo-disabled")) ?? [];
    return isDisabled.includes(domain);
}
