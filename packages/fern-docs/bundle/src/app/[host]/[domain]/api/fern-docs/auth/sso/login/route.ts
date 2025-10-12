import { getWorkOSClientId, workos } from "@fern-api/docs-server/auth/workos";

import { FernNextResponse } from "@fern-api/docs-server/FernNextResponse";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getWorkOSOrganizationDomains } from "@fern-docs/edge-config";
import { type NextRequest, NextResponse } from "next/server";

const INVITE_TOKEN_QUERY = "invitation_token";

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal() || isSelfHosted()) {
        return new NextResponse("sso is not accessible in local preview mode", {
            status: 400
        });
    }

    const inviteToken = req.nextUrl.searchParams.get(INVITE_TOKEN_QUERY);

    if (!inviteToken) {
        console.error("[sso:login] No invite_token param provided");
        return new NextResponse("invite_token is required", { status: 400 });
    }

    try {
        const invitation = await workos().userManagement.findInvitationByToken(inviteToken);

        if (!invitation.organizationId) {
            console.error("[sso:login] Invitation has no organizationId");
            return new NextResponse("Invalid invitation", { status: 400 });
        }

        const org = await workos().organizations.getOrganization(invitation.organizationId);

        // Fetch authentication config and filter for SSO domains
        const domain = await getWorkOSOrganizationDomains(org.name);

        if (!domain) {
            console.error("[sso:login] No SSO domain found in authentication config");
            return new NextResponse("SSO not configured", { status: 500 });
        }

        // Construct the callback URL using the SSO domain
        const callbackUrlString = `https://${domain}/api/fern-docs/auth/sso/callback`;

        let callbackUrl: URL;
        try {
            callbackUrl = new URL(callbackUrlString);
        } catch (urlError) {
            console.error("[sso:login] Invalid callback URL:", callbackUrlString, urlError);
            return new NextResponse("Invalid callback URL", { status: 500 });
        }

        // Generate the authorization URL with the organization-specific redirect
        const authorizationUrl = workos().userManagement.getAuthorizationUrl({
            provider: "authkit",
            clientId: getWorkOSClientId(),
            redirectUri: callbackUrl.toString(),
            organizationId: invitation.organizationId
        });

        // Redirect the user to the WorkOS authorization URL
        return FernNextResponse.redirect(req, {
            destination: authorizationUrl,
            allowedDestinations: ["https://api.workos.com"]
        });
    } catch (error) {
        const errorRes = {
            error: error instanceof Error ? error.message : String(error)
        };

        console.error(`[sso:login] ${JSON.stringify(errorRes)}`);

        return errorResponse();
    }
}

function errorResponse() {
    const errorBody = {
        error: {
            message: "Something went wrong!",
            description:
                "Couldn't initiate SSO login. If you are not sure what happened, please contact your organization admin."
        }
    };
    return NextResponse.json(errorBody, { status: 500 });
}
