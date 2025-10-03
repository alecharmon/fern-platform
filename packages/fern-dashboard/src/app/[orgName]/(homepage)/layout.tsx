import { ThemeProvider } from "next-themes";

import { AppLayout } from "@/components/layout/AppLayout";
import { SidepanelProvider } from "@/components/layout/SidepanelContext";
import { ServerSidePylonSetup } from "@/components/pylon/ServerSidePylonSetup";

import { Auth0OrgName } from "../../services/auth0/types";
import { OrgNameProvider } from "../context/OrgNameContext";

export default async function AuthedLayout({
    params,
    children,
    sidepanel,
    navbar,
    header
}: Readonly<{
    params: Promise<{ orgName: Auth0OrgName }>;
    children: React.JSX.Element;
    sidepanel: React.ReactNode;
    navbar: React.ReactNode;
    header: React.ReactNode;
}>) {
    const { orgName } = await params;

    return (
        <>
            <ServerSidePylonSetup />
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <OrgNameProvider orgName={orgName}>
                    <SidepanelProvider>
                        <AppLayout sidepanel={sidepanel} navbar={navbar} header={header}>
                            {children}
                        </AppLayout>
                    </SidepanelProvider>
                </OrgNameProvider>
            </ThemeProvider>
        </>
    );
}
