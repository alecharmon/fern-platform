import { FdrClient } from "@fern-api/fdr-sdk/client";
import { once } from "es-toolkit/function";

import { fernToken_admin } from "./env-variables";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

function getEnvironment() {
    // environment variable is used by local development
    return process.env.NEXT_PUBLIC_FDR_ORIGIN ?? "https://registry.buildwithfern.com";
}

export const provideRegistryService = once(() => {
    return new FdrClient({
        environment: getEnvironment(),
        token: isLocal() || isSelfHosted() ? undefined : fernToken_admin()
    });
});
