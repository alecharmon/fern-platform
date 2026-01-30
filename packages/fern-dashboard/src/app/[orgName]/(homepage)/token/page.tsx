import { getCurrentSession } from "../../../services/auth0/getCurrentSession";
import { redirectToLogin } from "../../../services/auth0/redirectToLogin";

export default async function TokenPage() {
    const session = await getCurrentSession();

    if (session == null) {
        return await redirectToLogin();
    }

    return (
        <div className="flex items-center justify-center">
            <code className="break-all">{session.accessToken}</code>
        </div>
    );
}
