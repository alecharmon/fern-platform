import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default async function Page() {
    const session = await getCurrentSession();
    if (session == null) {
        return await redirectToLogin();
    }
    return <SettingsPage session={session} />;
}
