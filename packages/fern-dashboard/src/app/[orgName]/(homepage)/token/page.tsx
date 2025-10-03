import { redirect } from "next/navigation";

import { getCurrentSessionOrThrow } from "../../../services/auth0/getCurrentSession";

export default async function TokenPage() {
    const session = await getCurrentSessionOrThrow();

    if (session == null) {
        redirect("/");
    }

    return (
        <div className="flex items-center justify-center">
            <code className="break-all">{session.accessToken}</code>
        </div>
    );
}
