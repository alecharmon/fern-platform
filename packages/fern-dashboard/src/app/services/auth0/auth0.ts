/* eslint-disable turbo/no-undeclared-env-vars */
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { cache } from "react";

import { getAppUrlServerSide } from "../../../utils/getAppUrlServerSide";

/**
 * Creates a cached Auth0Client instance for the current request.
 * Uses React.cache() to deduplicate client creation within a single request tree.
 */
export const getAuth0Client = cache(async () => {
    return new Auth0Client({
        async beforeSessionSaved(session, idToken) {
            return {
                ...session,
                idToken
            };
        },
        authorizationParameters: {
            audience: process.env.NEXT_PUBLIC_VENUS_AUDIENCE
        },
        appBaseUrl: await getAppUrlServerSide(),
        httpTimeout: 60_000
    });
});

export function getAuth0ClientId() {
    if (process.env.AUTH0_CLIENT_ID == null) {
        throw new Error("AUTH0_CLIENT_ID is not defined in the current environment");
    }
    return process.env.AUTH0_CLIENT_ID;
}
