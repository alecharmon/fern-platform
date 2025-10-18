import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default async function Page() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }
    return <SettingsPage session={session} />;
}
