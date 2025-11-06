import { redirect } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";
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

    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }

    const isCreateDocsNewSiteEnabled = await isFeatureFlagEnabledForUser(
        PosthogFeatureFlag.ENABLE_CREATE_DOCS_NEW_SITE,
        session.user.sub,
        orgName
    );

    if (!isCreateDocsNewSiteEnabled) {
        redirect(`/${orgName}/docs`);
    }

    return (
        <>
            <ServerSidePylonSetup />
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <OrgNameProvider orgName={orgName}>{children}</OrgNameProvider>
            </ThemeProvider>
        </>
    );
}
