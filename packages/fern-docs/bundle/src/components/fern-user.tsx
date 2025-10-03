import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { SetFernUser } from "@fern-docs/components/state/fern-user";

import { getFernToken } from "@/app/fern-token";

export async function FernUser({ host, domain }: { host: string; domain: string }) {
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const authState = await loader.getAuthState();
    return <SetFernUser value={authState.authed ? authState.user : undefined} />;
}
