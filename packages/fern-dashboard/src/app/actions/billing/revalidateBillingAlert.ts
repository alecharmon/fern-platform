"use server";

import { updateTag } from "next/cache";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getBillingAlertCacheTag } from "@/components/org-alert/HeaderBillingAlert";

export async function revalidateBillingAlert(orgId: string) {
    await getCurrentSessionOrThrow();
    updateTag(getBillingAlertCacheTag(orgId));
}
