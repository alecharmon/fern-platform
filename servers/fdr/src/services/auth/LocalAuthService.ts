import type { AuthService, OrgIdsResponse } from "./AuthService";

export class LocalAuthServiceImpl implements AuthService {
    orgIds: string[];
    constructor({ orgIds }: { orgIds: string[] }) {
        this.orgIds = orgIds;
    }

    async getOrgIdsFromAuthHeader({ authHeader }: { authHeader: string | undefined }): Promise<OrgIdsResponse> {
        return {
            type: "success",
            orgIds: new Set<string>(this.orgIds)
        };
    }

    async checkUserBelongsToOrg({
        authHeader,
        orgId
    }: {
        authHeader: string | undefined;
        orgId: string;
    }): Promise<void> {
        return;
    }

    async checkOrgHasSnippetsApiAccess({
        authHeader,
        orgId,
        failHard
    }: {
        authHeader: string | undefined;
        orgId: string;
        failHard?: boolean;
    }): Promise<boolean> {
        return false;
    }

    async checkOrgHasSnippetTemplateAccess({
        authHeader,
        orgId,
        failHard
    }: {
        authHeader: string | undefined;
        orgId: string;
        failHard?: boolean;
    }): Promise<boolean> {
        return false;
    }

    async checkUserHasCliPermission({
        authHeader,
        orgId,
        docsUrl
    }: {
        authHeader: string | undefined;
        orgId: string;
        docsUrl?: string;
    }): Promise<void> {
        // In local development, always allow CLI access
        return;
    }
}
