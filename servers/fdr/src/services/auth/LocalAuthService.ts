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

    async getUserEmailFromAuthHeader({ authHeader }: { authHeader: string | undefined }): Promise<string | undefined> {
        return "local-dev@buildwithfern.com";
    }

    async getUserIdFromAuthHeader({ authHeader }: { authHeader: string | undefined }): Promise<string | undefined> {
        return "local-dev-user-id";
    }

    async getOrgDisplayNameById({
        authHeader,
        orgId
    }: {
        authHeader: string | undefined;
        orgId: string;
    }): Promise<string | undefined> {
        return `Local Org (${orgId})`;
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
        return;
    }

    async verifyDocsPdfExporterLambdaToken(_authHeader: string | undefined): Promise<void> {
        return;
    }

    verifyCronSecret(_headers: Record<string, string | undefined>): void {
        return;
    }
}
