import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { AiCreditUsagePage } from "@/components/ai-usage/AiCreditUsagePage";

export default async function Page({ params }: Readonly<{ params: Promise<{ orgName: Auth0OrgName }> }>) {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }
    const { orgName } = await params;
    return (
        <div className="flex flex-1 flex-col items-center">
            <AiCreditUsagePage orgName={orgName} />
        </div>
    );
}
