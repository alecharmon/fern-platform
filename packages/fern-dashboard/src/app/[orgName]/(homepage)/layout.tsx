import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { EnableNoiseAnimation } from "@/components/EnableNoiseAnimation";
import { AppLayout } from "@/components/layout/AppLayout";
import { SidepanelProvider } from "@/components/layout/SidepanelContext";
import { ServerSidePylonSetup } from "@/components/pylon/ServerSidePylonSetup";
import type { Auth0OrgName } from "../../services/auth0/types";
import { OrgNameProvider } from "../context/OrgNameContext";

export async function generateMetadata({ params }: { params: Promise<{ orgName: Auth0OrgName }> }): Promise<Metadata> {
    const { orgName } = await params;
    return {
        title: `Fern Dashboard - ${orgName}`
    };
}

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
            <EnableNoiseAnimation />
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
