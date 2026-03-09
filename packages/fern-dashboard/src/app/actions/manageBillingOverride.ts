"use server";

import { createBillingOverride, type OrgBillingOverride, revokeBillingOverride } from "@fern-platform/billing";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";

export interface AddOverrideParams {
    orgId: string;
    sku: string;
    startDate?: string;
    endDate?: string | null;
    notes?: string | null;
}

export async function addBillingOverrideAction(
    params: AddOverrideParams
): Promise<{ override: OrgBillingOverride } | { error: string }> {
    const session = await getCurrentSessionOrThrow();

    if (!auth0Management.isSuperUser(session.permissions ?? [])) {
        return { error: "Unauthorized: super-user permission required" };
    }

    const result = await createBillingOverride({
        org_id: params.orgId,
        sku: params.sku,
        added_by: session.user?.email ?? "unknown",
        start_date: params.startDate,
        end_date: params.endDate,
        notes: params.notes
    });

    if (result.isErr()) {
        return { error: result.error.message };
    }

    return { override: result.value };
}

export async function revokeBillingOverrideAction(
    overrideId: string
): Promise<{ override: OrgBillingOverride } | { error: string }> {
    const session = await getCurrentSessionOrThrow();

    if (!auth0Management.isSuperUser(session.permissions ?? [])) {
        return { error: "Unauthorized: super-user permission required" };
    }

    const result = await revokeBillingOverride(overrideId);

    if (result.isErr()) {
        return { error: result.error.message };
    }

    return { override: result.value };
}
