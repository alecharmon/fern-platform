import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";

import { getFernToken } from "@/app/fern-token";
import { PlaygroundCloseButton } from "@/components/playground/PlaygroundCloseButton";
import { PlaygroundKeyboardTrigger } from "@/components/playground/PlaygroundKeyboardTrigger";
import { HorizontalSplitPane } from "@/components/playground/VerticalSplitPane";
import { ApiExplorerFlags } from "@/state/api-explorer-flags";

export default async function Layout({
    params,
    children,
    sidebar
}: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    params: Promise<{ host: string; domain: string }>;
}) {
    const { host, domain } = await params;

    console.debug(`[${domain}] Loading API Explorer layout`);
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const edgeFlags = await loader.getEdgeFlags();

    return (
        <main className="fixed inset-0">
            <PlaygroundKeyboardTrigger />
            <PlaygroundCloseButton />
            <ApiExplorerFlags
                isFileForgeHackEnabled={edgeFlags.isFileForgeHackEnabled}
                isProxyDisabled={edgeFlags.isProxyDisabled}
                usesApplicationJsonInFormDataValue={edgeFlags.usesApplicationJsonInFormDataValue}
                isBinaryOctetStreamAudioPlayer={edgeFlags.isBinaryOctetStreamAudioPlayer}
            />
            <HorizontalSplitPane
                mode="pixel"
                className="size-full"
                leftClassName="border-border-default border-r hidden lg:block"
            >
                {sidebar}
                {children}
            </HorizontalSplitPane>
        </main>
    );
}
