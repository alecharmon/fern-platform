import { redirect } from "next/navigation";
import { ThemeProvider } from "next-themes";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { ServerSidePylonSetup } from "@/components/pylon/ServerSidePylonSetup";
import { OnboardingProvider } from "@/providers/OnboardingProvider";

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

    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }

    return (
        <>
            <ServerSidePylonSetup />
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <OrgNameProvider orgName={orgName}>
                    <OnboardingProvider>{children}</OnboardingProvider>
                </OrgNameProvider>
            </ThemeProvider>
        </>
    );
}
