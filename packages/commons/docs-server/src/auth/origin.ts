import { getEnv } from "@vercel/functions";

import { isSelfHosted } from "../isSelfHosted";

export function preferPreview(host: string, domain: string) {
    // In self-hosted mode, always use the domain (the external-facing hostname)
    // because `host` may be the internal Next.js server address (e.g. localhost:3001)
    if (isSelfHosted()) {
        return domain;
    }

    const { VERCEL_ENV } = getEnv();
    if (VERCEL_ENV === "production") {
        return domain;
    }
    return host || domain;
}
