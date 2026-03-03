import { isSuperUser } from "@fern-api/user-permissions";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { BillingInfo } from "@/components/settings/BillingInfo";

export default async function Page() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }
    const showSuperUserPricing = isSuperUser(session.permissions ?? []);
    return (
        <div className="flex flex-1 flex-col items-center">
            <BillingInfo session={session} showSuperUserPricing={showSuperUserPricing} />
        </div>
    );
}
