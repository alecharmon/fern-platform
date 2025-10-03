import { createCachedDocsLoader } from "@fern-api/docs-loader";

import { getFernToken } from "@/app/fern-token";
import { InterceptedPlaygroundCloseButton } from "@/components/playground/PlaygroundCloseButton";
import { PlaygroundDrawer } from "@/components/playground/PlaygroundDrawer";
import { HorizontalSplitPane } from "@/components/playground/VerticalSplitPane";
import { ApiExplorerFlags } from "@/state/api-explorer-flags";

export default async function ExplorerLayout({
    children,
    params,
    sidebar
}: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    params: Promise<{ host: string; domain: string }>;
}) {
    const { host, domain } = await params;

    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const edgeFlags = await loader.getEdgeFlags();

    return (
        <PlaygroundDrawer>
            <InterceptedPlaygroundCloseButton />
            <ApiExplorerFlags
                isFileForgeHackEnabled={edgeFlags.isFileForgeHackEnabled}
                isProxyDisabled={edgeFlags.isProxyDisabled}
                usesApplicationJsonInFormDataValue={edgeFlags.usesApplicationJsonInFormDataValue}
                isBinaryOctetStreamAudioPlayer={edgeFlags.isBinaryOctetStreamAudioPlayer}
            />

            <HorizontalSplitPane
                mode="pixel"
                className="w-full flex-1 overflow-y-auto"
                leftClassName="border-border-default border-r hidden lg:block"
            >
                {sidebar}
                {children}
            </HorizontalSplitPane>
        </PlaygroundDrawer>
    );
}
