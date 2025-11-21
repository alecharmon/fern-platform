import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { isFernEmployee } from "@/app/services/auth0/management";
import { MembersPage } from "@/components/members/MembersPage";

export default async function Page() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }
    const isFernAdmin = await isFernEmployee(session.user.sub);
    return <MembersPage session={session} isFernAdmin={isFernAdmin} />;
}
