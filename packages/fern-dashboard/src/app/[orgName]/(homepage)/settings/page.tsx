import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { cachedGetPostmanConnection } from "@/app/services/dal/postman/cachedGetPostmanConnection";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default async function Page({ params }: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const { orgName } = await params;
    const session = await getCurrentSession();
    if (session == null) {
        return await redirectToLogin();
    }

    const postmanConnection = await cachedGetPostmanConnection({
        orgName,
        token: session.accessToken
    });

    return <SettingsPage session={session} postmanConnection={postmanConnection} />;
}
