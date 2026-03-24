import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WizardFormData } from "@/providers/OnboardingProvider";
import * as onboardingSessionModule from "@/utils/onboardingSession";
import * as apiModule from "../api";
import * as completionHandlersModule from "../completion-handlers";
import { usePublishingWorkflow } from "../usePublishingWorkflow";

// Track call order to verify linking completes before isComplete is set
const callOrder: string[] = [];

vi.mock("@/utils/onboardingSession", () => ({
    getGithubRepoData: vi.fn(),
    getSitePublishUrl: vi.fn(),
    getDocsCommitSha: vi.fn(),
    saveGithubRepoData: vi.fn(),
    saveSitePublishUrl: vi.fn(),
    saveDocsCommitSha: vi.fn()
}));

vi.mock("../repoSetupStorage", () => ({
    clearRepoSetupResult: vi.fn()
}));

vi.mock("../api", () => ({
    getOrCreateRepoForPublishing: vi.fn(),
    performCustomization: vi.fn(),
    fetchWorkflowStatus: vi.fn(),
    retryPublishingWorkflow: vi.fn()
}));

vi.mock("../completion-handlers", () => ({
    handleWorkflowSuccess: vi.fn(),
    sendSlackNotification: vi.fn()
}));

const mockGetGithubRepoData = vi.mocked(onboardingSessionModule.getGithubRepoData);
const mockGetSitePublishUrl = vi.mocked(onboardingSessionModule.getSitePublishUrl);
const mockGetDocsCommitSha = vi.mocked(onboardingSessionModule.getDocsCommitSha);
const mockGetOrCreateRepo = vi.mocked(apiModule.getOrCreateRepoForPublishing);
const mockPerformCustomization = vi.mocked(apiModule.performCustomization);
const mockFetchWorkflowStatus = vi.mocked(apiModule.fetchWorkflowStatus);
const mockHandleWorkflowSuccess = vi.mocked(completionHandlersModule.handleWorkflowSuccess);
const mockSendSlackNotification = vi.mocked(completionHandlersModule.sendSlackNotification);

const MOCK_FORM_DATA: WizardFormData = {
    docsSiteName: "My Org Docs",
    docsSiteUrl: "my-org",
    docsSiteUrlSource: "auto",
    docsSiteUrlAvailable: true,
    faviconUrl: null,
    logoUrl: null,
    faviconFile: null,
    logoFile: null,
    faviconFileName: null,
    logoFileName: null,
    primaryColorHex: "#008700",
    existingDocsSite: "",
    openApiSpecFiles: [],
    openApiSpecUrls: [],
    sitePublishUrl: null,
    postmanCollectionId: null,
    postmanTeamId: null
};

function applyDefaultMocks(): void {
    mockGetGithubRepoData.mockReturnValue({
        owner: "fern-support",
        repoName: "my-repo",
        repoUrl: "https://github.com/fern-support/my-repo"
    });
    mockGetSitePublishUrl.mockReturnValue("https://my-org.docs.buildwithfern.com");
    mockGetDocsCommitSha.mockReturnValue("abc123");
    mockGetOrCreateRepo.mockResolvedValue({
        owner: "fern-support",
        repoName: "my-repo",
        githubRepoUrl: "https://github.com/fern-support/my-repo"
    });
    mockPerformCustomization.mockResolvedValue({
        commitSha: "abc123",
        docsUrl: "https://my-org.docs.buildwithfern.com"
    });
    mockHandleWorkflowSuccess.mockImplementation(async () => {
        callOrder.push("handleWorkflowSuccess");
    });
    mockSendSlackNotification.mockImplementation(() => {});
}

describe("usePublishingWorkflow", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        callOrder.length = 0;
        applyDefaultMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should link repo to docs site before setting isComplete on workflow success", async () => {
        mockFetchWorkflowStatus.mockResolvedValue(
            new Response(JSON.stringify({ status: "completed", conclusion: "success" }), { status: 200 })
        );

        const onComplete = vi.fn().mockImplementation(() => {
            callOrder.push("onComplete");
        });

        const { result } = renderHook(() =>
            usePublishingWorkflow({
                wizardFormData: MOCK_FORM_DATA,
                orgName: "my-org",
                onComplete
            })
        );

        // Advance through repo creation, customization, and polling
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        await waitFor(() => {
            expect(result.current.isComplete).toBe(true);
        });

        // Verify handleWorkflowSuccess was called (repo was linked)
        expect(mockHandleWorkflowSuccess).toHaveBeenCalledWith(
            "https://my-org.docs.buildwithfern.com",
            "my-org",
            "https://github.com/fern-support/my-repo",
            false
        );

        // Verify handleWorkflowSuccess was called before onComplete
        expect(callOrder.indexOf("handleWorkflowSuccess")).toBeLessThan(callOrder.indexOf("onComplete"));
    });

    it("should not call handleWorkflowSuccess when publishUrl is missing", async () => {
        mockGetSitePublishUrl.mockReturnValue(null);
        mockFetchWorkflowStatus.mockResolvedValue(
            new Response(JSON.stringify({ status: "completed", conclusion: "success" }), { status: 200 })
        );

        const { result } = renderHook(() =>
            usePublishingWorkflow({
                wizardFormData: MOCK_FORM_DATA,
                orgName: "my-org"
            })
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        await waitFor(() => {
            expect(result.current.isComplete).toBe(true);
        });

        expect(mockHandleWorkflowSuccess).not.toHaveBeenCalled();
    });

    it("should set workflowFailed when workflow conclusion is not success", async () => {
        mockFetchWorkflowStatus.mockResolvedValue(
            new Response(JSON.stringify({ status: "completed", conclusion: "failure" }), { status: 200 })
        );

        const { result } = renderHook(() =>
            usePublishingWorkflow({
                wizardFormData: MOCK_FORM_DATA,
                orgName: "my-org"
            })
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        await waitFor(() => {
            expect(result.current.workflowFailed).toBe(true);
        });

        expect(result.current.stepStates.docs).toBe("failed");
    });

    it("should not link repo twice on repeated successful polls", async () => {
        mockFetchWorkflowStatus.mockResolvedValue(
            new Response(JSON.stringify({ status: "completed", conclusion: "success" }), { status: 200 })
        );

        renderHook(() =>
            usePublishingWorkflow({
                wizardFormData: MOCK_FORM_DATA,
                orgName: "my-org"
            })
        );

        // Run through multiple poll cycles
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        // handleWorkflowSuccess should only be called once due to hasLinkedRepo ref
        expect(mockHandleWorkflowSuccess).toHaveBeenCalledTimes(1);
    });
});
