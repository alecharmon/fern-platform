interface CreditsCheckRequestBody {
    org_id: string;
}

/**
 * TODO: Wire up to entitlements system to check credit allowance.
 * For now, returns a stub that always allows usage.
 */
export default async function handleCreditsCheck(_body: CreditsCheckRequestBody) {
    return { allowed: true, used: 0, limit: 0 };
}
