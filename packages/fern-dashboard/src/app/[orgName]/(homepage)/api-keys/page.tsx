import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import { ApiKeysPage } from "@/components/api-keys/ApiKeysPage";

export default async function Page() {
    const session = await getCurrentSession();
    if (session == null) {
        return await redirectToLogin();
    }
    return <ApiKeysPage session={session} />;
}
