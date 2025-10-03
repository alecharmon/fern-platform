import { createHmac } from "node:crypto";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

import { PylonSetup } from "./PylonSetup";

/* eslint-disable turbo/no-undeclared-env-vars */

export async function ServerSidePylonSetup() {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    return (
        <PylonSetup
            user={session.user}
            emailHash={session.user.email != null ? await hashEmail(session.user.email) : undefined}
        />
    );
}

async function hashEmail(email: string) {
    if (email == null) {
        return undefined;
    }

    if (process.env.PYLON_IDENTITY_VERIFICATION_SECRET == null) {
        throw new Error("PYLON_IDENTITY_VERIFICATION_SECRET is not defined in the environment");
    }

    return createHmac("sha256", Buffer.from(process.env.PYLON_IDENTITY_VERIFICATION_SECRET, "hex"))
        .update(email)
        .digest("hex");
}
