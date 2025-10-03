import { getEdge } from "./getEdge";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

type CanonicalUrl = Record<string, string>;

export async function getCanonicalUrl(domain: string): Promise<string | undefined> {
    if (isLocal() || isSelfHosted()) {
        return domain;
    }

    const config = await getEdge<CanonicalUrl>("canonical-host");
    return config?.[domain];
}
