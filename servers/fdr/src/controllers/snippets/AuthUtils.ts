import { FdrAPI } from "@fern-api/fdr-sdk";
import { ORPCError } from "@orpc/server";
import type { FdrApplication } from "../../app";

export class AuthUtility {
    constructor(
        private readonly app: FdrApplication,
        private readonly authHeader: string
    ) {}
    public async inferOrg(): Promise<FdrAPI.OrgId> {
        const orgIds = await this.getOrgIds();
        if (orgIds.size > 1) {
            throw new ORPCError("BAD_REQUEST", {
                message: "Your user has access to multiple organizations. Please provide an orgId"
            });
        }
        const inferredOrgId = Array.from(orgIds)[0];
        if (inferredOrgId == null) {
            throw new ORPCError("NOT_FOUND", { message: "No organizations were resolved for this user" });
        }
        return FdrAPI.OrgId(inferredOrgId);
    }

    public async assertUserHasAccessToOrg(orgId: string) {
        const orgIds = await this.getOrgIds();
        if (!orgIds.has(orgId)) {
            throw new ORPCError("UNAUTHORIZED", { message: `You are not a member of organization ${orgId}` });
        }
    }

    public async getOrgIds(): Promise<Set<string>> {
        const orgIdsResponse = await this.app.services.auth.getOrgIdsFromAuthHeader({
            authHeader: this.authHeader
        });
        if (orgIdsResponse.type === "error") {
            throw orgIdsResponse.err;
        }
        return orgIdsResponse.orgIds;
    }
}
