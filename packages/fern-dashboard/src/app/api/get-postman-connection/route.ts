import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getAppInstallationByTeamId } from "@/app/services/postman/repository";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator } from "../utils/validators";

export declare namespace getPostmanConnection {
    export type Request = z.infer<typeof GetPostmanConnectionRequest>;
    export type Response = ResolvedReturnType<typeof handleGetPostmanConnection>;
}

const GetPostmanConnectionRequest = z.object({
    orgName: orgNameValidator
});

async function handleGetPostmanConnection(token: string, orgName: string): Promise<PostmanConnectionInfo | null> {
    const venus = getVenusClient({ token });
    const orgResponse = await venus.organization.get(orgName);

    if (!orgResponse.ok || !orgResponse.body.postmanTeamId) {
        return null;
    }

    const teamId = orgResponse.body.postmanTeamId;

    const appInstallation = await getAppInstallationByTeamId(teamId);
    const teamName = appInstallation?.team_name ?? null;

    return {
        teamId,
        teamName
    };
}

interface PostmanConnectionInfo {
    teamId: string;
    teamName: string | null;
}

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { token } = maybeSessionData.data;

    const parsedBody = await parseNextRequestBody(req, GetPostmanConnectionRequest);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }
    const { orgName } = parsedBody.data;

    await assertUserHasOrganizationAccess(token, orgName);

    return NextResponse.json(await handleGetPostmanConnection(token, orgName));
}
