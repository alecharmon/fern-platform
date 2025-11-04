import { ThemeProvider } from "next-themes";

import { ServerSidePylonSetup } from "@/components/pylon/ServerSidePylonSetup";

import type { Auth0OrgName } from "../../services/auth0/types";
import { OrgNameProvider } from "../context/OrgNameContext";

export default async function WizardLayout({
    params,
    children
}: Readonly<{
    params: Promise<{ orgName: Auth0OrgName }>;
    children: React.ReactNode;
}>) {
    const { orgName } = await params;

    return (
        <>
            <ServerSidePylonSetup />
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <OrgNameProvider orgName={orgName}>{children}</OrgNameProvider>
            </ThemeProvider>
        </>
    );
}
