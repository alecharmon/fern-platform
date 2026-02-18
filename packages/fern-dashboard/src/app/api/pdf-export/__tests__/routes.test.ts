import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { POST as createTask } from "../create-task/route";
import { POST as getDownloadUrl } from "../get-download-url/route";
import { POST as listTasks } from "../list-tasks/route";

vi.mock("@/app/api/utils/maybeGetCurrentSession", () => ({
    maybeGetCurrentSession: vi.fn()
}));

vi.mock("@/app/services/dal/organization", () => ({
    assertUserHasOrganizationAccess: vi.fn()
}));

vi.mock("@/app/services/auth0/management", () => ({
    getOrgIdFromName: vi.fn()
}));

vi.mock("@fern-api/user-permissions", async (importOriginal) => {
    const original = (await importOriginal()) as Record<string, unknown>;
    return {
        ...original,
        hasResourcePermission: vi.fn()
    };
});

vi.mock("@/app/services/fdr/getFdrClient", () => ({
    getFdrBaseUrl: vi.fn()
}));

import { hasResourcePermission } from "@fern-api/user-permissions";
import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getFdrBaseUrl } from "@/app/services/fdr/getFdrClient";

const mockMaybeGetCurrentSession = maybeGetCurrentSession as Mock;
const mockAssertUserHasOrganizationAccess = assertUserHasOrganizationAccess as Mock;
const mockGetOrgIdFromName = getOrgIdFromName as Mock;
const mockHasResourcePermission = hasResourcePermission as Mock;
const mockGetFdrBaseUrl = getFdrBaseUrl as Mock;

describe("pdf-export API routes auth middleware", () => {
    const token = "test-token";
    const userId = "auth0|user";
    const orgName = "acme";
    const docsUrl = "acme.docs.buildwithfern.com";

    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockMaybeGetCurrentSession.mockResolvedValue({
            data: { token, userId, permissions: ["view", "manage-settings"], orgId: "org_123" }
        });
        mockAssertUserHasOrganizationAccess.mockResolvedValue(undefined);
        mockGetOrgIdFromName.mockResolvedValue("org_123");
        mockHasResourcePermission.mockResolvedValue(true);

        mockGetFdrBaseUrl.mockReturnValue("http://localhost:8080");
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                tasks: [],
                id: "task_1",
                downloadUrl: "https://example.com/file.pdf",
                fileName: "file.pdf",
                sizeBytes: 123
            })
        });
        vi.stubGlobal("fetch", mockFetch);
    });

    // ---- Step 1: Session validation ----

    it("returns 401 when session is invalid", async () => {
        mockMaybeGetCurrentSession.mockResolvedValue({
            errorResponse: new Response(JSON.stringify({ message: "Unable to get current session" }), { status: 401 })
        });

        const request = new NextRequest("http://localhost:3000/api/pdf-export/list-tasks", {
            method: "POST",
            body: JSON.stringify({ orgName, docsUrl })
        });

        const response = await listTasks(request);
        expect(response.status).toBe(401);
    });

    // ---- Step 2: Org-level permission check ----

    it("returns 403 when user lacks required org-level permission", async () => {
        // User only has "view" but create-task requires ["view", "manage-settings"]
        mockMaybeGetCurrentSession.mockResolvedValue({
            data: { token, userId, permissions: ["view"], orgId: "org_123" }
        });

        const request = new NextRequest("http://localhost:3000/api/pdf-export/create-task", {
            method: "POST",
            body: JSON.stringify({ orgName, docsUrl, options: {} })
        });

        const response = await createTask(request);
        expect(response.status).toBe(403);
    });

    // ---- Step 3: Org membership ----

    it("returns 403 when user is not a member of the org", async () => {
        mockAssertUserHasOrganizationAccess.mockRejectedValue(new Error("not a member"));

        const request = new NextRequest("http://localhost:3000/api/pdf-export/create-task", {
            method: "POST",
            body: JSON.stringify({ orgName, docsUrl, options: {} })
        });

        const response = await createTask(request);
        expect(response.status).toBe(403);
    });

    // ---- Step 4: Resource-scoped "view" on docsUrl ----

    it("returns 403 when user cannot view the docsUrl", async () => {
        mockHasResourcePermission.mockResolvedValue(false);

        const request = new NextRequest("http://localhost:3000/api/pdf-export/list-tasks", {
            method: "POST",
            body: JSON.stringify({ orgName, docsUrl })
        });

        const response = await listTasks(request);
        expect(response.status).toBe(403);
    });

    it("calls hasResourcePermission with 'view' for the docsUrl", async () => {
        const request = new NextRequest("http://localhost:3000/api/pdf-export/list-tasks", {
            method: "POST",
            body: JSON.stringify({ orgName, docsUrl })
        });

        await listTasks(request);

        expect(mockHasResourcePermission).toHaveBeenCalledWith(
            expect.objectContaining({
                permissionToCheck: "view",
                resourceType: "docs",
                resourceId: docsUrl
            })
        );
    });

    // ---- Happy paths ----

    it("list-tasks succeeds with valid session and permissions", async () => {
        const request = new NextRequest("http://localhost:3000/api/pdf-export/list-tasks", {
            method: "POST",
            body: JSON.stringify({ orgName, docsUrl })
        });

        const response = await listTasks(request);
        expect(response.status).toBe(200);
    });

    it("create-task succeeds with valid session and permissions", async () => {
        const request = new NextRequest("http://localhost:3000/api/pdf-export/create-task", {
            method: "POST",
            body: JSON.stringify({ orgName, docsUrl, options: {} })
        });

        const response = await createTask(request);
        expect(response.status).toBe(200);
    });

    it("get-download-url succeeds with valid session and permissions", async () => {
        const request = new NextRequest("http://localhost:3000/api/pdf-export/get-download-url", {
            method: "POST",
            body: JSON.stringify({ orgName, docsUrl, taskId: "task_1" })
        });

        const response = await getDownloadUrl(request);
        expect(response.status).toBe(200);
    });
});
