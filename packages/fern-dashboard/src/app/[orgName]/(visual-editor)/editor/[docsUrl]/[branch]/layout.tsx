import "server-only";

import { ThemeProvider } from "next-themes";
import type React from "react";
import { ClientMDXProvider } from "@/app/[orgName]/context/ClientMDXProvider";
import { OrgNameProvider } from "@/app/[orgName]/context/OrgNameContext";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { EditorProvidersWrapper } from "@/components/editor/EditorProvidersWrapper";
import { HeaderToolbar } from "@/components/editor/HeaderToolbar";
import { NeedsSetupBanner } from "@/components/editor/NeedsSetupBanner";
import { PreviewOnlyNotification } from "@/components/editor/PreviewOnlyNotification";
import { ServerSidePylonSetup } from "@/components/pylon/ServerSidePylonSetup";
import { BranchProvider } from "@/providers/BranchContext";
import { CurrentPageProvider } from "@/providers/CurrentPageContext";
import { DevModeProvider } from "@/providers/DevModeProvider";
import { EditorProvider } from "@/providers/EditorContext";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

function EditorShell({ children }: { children: React.ReactNode }) {
    return <div className="flex w-full flex-col overflow-hidden">{children}</div>;
}

export default async function EditorLayout({
    params,
    children
}: Readonly<{
    params: Promise<{
        orgName: Auth0OrgName;
        docsUrl: EncodedDocsUrl;
        branch: string;
    }>;
    children: React.JSX.Element;
}>) {
    const { orgName, docsUrl: encodedDocsUrl, branch } = await params;
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

    const { session } = await assertAuthAndFetchGithubUrl(orgName, docsUrl);

    return (
        <>
            <ServerSidePylonSetup />
            <EditorShell>
                <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
                    <OrgNameProvider orgName={orgName}>
                        <BranchProvider branch={branch}>
                            <EditorProvidersWrapper branch={branch} orgName={orgName} docsUrl={docsUrl}>
                                <CurrentPageProvider>
                                    <ClientMDXProvider>
                                        <DevModeProvider>
                                            <EditorProvider>
                                                <NeedsSetupBanner docsUrl={docsUrl} orgName={orgName} />
                                                <HeaderToolbar session={session} docsUrl={docsUrl} />
                                                <PreviewOnlyNotification />
                                                {children}
                                            </EditorProvider>
                                        </DevModeProvider>
                                    </ClientMDXProvider>
                                </CurrentPageProvider>
                            </EditorProvidersWrapper>
                        </BranchProvider>
                    </OrgNameProvider>
                </ThemeProvider>
            </EditorShell>
        </>
    );
}
