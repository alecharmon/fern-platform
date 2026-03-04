import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";

import { AppLayout } from "@/components/layout/AppLayout";
import { SidepanelProvider } from "@/components/layout/SidepanelContext";
import { ServerSidePylonSetup } from "@/components/pylon/ServerSidePylonSetup";
import { LazyUpsellModal, UpsellProvider } from "@/components/upsells";
import { EntitlementsProvider } from "@/providers/EntitlementsProvider";

import getOrgEntitlements from "../../api/get-org-entitlements/handler";
import { getCurrentSession } from "../../services/auth0/getCurrentSession";
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

    let initialEntitlements: Awaited<ReturnType<typeof getOrgEntitlements>> | undefined;
    try {
        const session = await getCurrentSession();
        if (session != null) {
            initialEntitlements = await getOrgEntitlements({
                orgName,
                permissions: session.permissions ?? []
            });
        }
    } catch (error) {
        console.error("[AuthedLayout] Failed to pre-fetch entitlements", error);
    }

    return (
        <>
            <ServerSidePylonSetup />
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <OrgNameProvider orgName={orgName}>
                    <EntitlementsProvider initialData={initialEntitlements}>
                        <UpsellProvider>
                            <SidepanelProvider>
                                <AppLayout sidepanel={sidepanel} navbar={navbar} header={header}>
                                    {children}
                                </AppLayout>
                            </SidepanelProvider>
                            <LazyUpsellModal />
                        </UpsellProvider>
                    </EntitlementsProvider>
                </OrgNameProvider>
            </ThemeProvider>
        </>
    );
}
