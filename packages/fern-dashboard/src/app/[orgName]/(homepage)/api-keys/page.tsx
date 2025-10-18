import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { ApiKeysPage } from "@/components/api-keys/ApiKeysPage";

export default async function Page() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }
    return <ApiKeysPage session={session} />;
}
