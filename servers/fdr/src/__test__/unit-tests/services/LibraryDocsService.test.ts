import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FdrApplication } from "../../../app";
import type { FdrConfig } from "../../../app/FdrConfig";
import { getMockFdrConfig } from "../../mock";

vi.mock("../../../services/library-docs/LambdaInvoker", () => {
    return {
        LambdaInvoker: vi.fn().mockImplementation(() => ({
            invoke: vi.fn().mockResolvedValue({ status: "success", irS3Key: "test-key" })
        }))
    };
});

vi.mock("../../../services/library-docs/ResultStorage", () => {
    return {
        ResultStorage: vi.fn().mockImplementation(() => ({
            getPresignedDownloadUrl: vi.fn().mockResolvedValue("https://example.com/presigned")
        }))
    };
});

import { LambdaInvoker } from "../../../services/library-docs/LambdaInvoker";
import { LibraryDocsServiceImpl } from "../../../services/library-docs/LibraryDocsService";

const MockLambdaInvoker = vi.mocked(LambdaInvoker);

function createMockDao() {
    return {
        createGeneration: vi.fn().mockResolvedValue(undefined),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        saveError: vi.fn().mockResolvedValue(undefined),
        setIrS3Key: vi.fn().mockResolvedValue(undefined),
        getGeneration: vi.fn().mockResolvedValue(null)
    };
}

function createMockApp(configOverrides?: Partial<FdrConfig>) {
    const mockDao = createMockDao();
    const app = {
        config: getMockFdrConfig(configOverrides),
        dao: {
            libraryDocs: () => mockDao
        },
        logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
    } as unknown as FdrApplication;
    return { app, mockDao };
}

describe("LibraryDocsServiceImpl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("invokes Python Lambda when language is PYTHON", async () => {
        const { app, mockDao } = createMockApp({
            pythonLibraryDocsLambda: { functionName: "python-fn", region: "us-east-1" },
            cppLibraryDocsLambda: { functionName: "cpp-fn", region: "us-east-1" }
        });

        const service = new LibraryDocsServiceImpl(app);

        expect(MockLambdaInvoker).toHaveBeenCalledTimes(2);
        const pythonInvokerInstance = MockLambdaInvoker.mock.results[0]!.value;

        await service.startGeneration({
            orgId: "org-1",
            githubUrl: "https://github.com/test/repo",
            language: "PYTHON"
        });

        await vi.waitFor(() => {
            expect(mockDao.updateStatus).toHaveBeenCalledWith(expect.any(String), "COMPLETED");
        });

        expect(pythonInvokerInstance.invoke).toHaveBeenCalled();
    });

    it("invokes C++ Lambda when language is CPP", async () => {
        const { app, mockDao } = createMockApp({
            pythonLibraryDocsLambda: { functionName: "python-fn", region: "us-east-1" },
            cppLibraryDocsLambda: { functionName: "cpp-fn", region: "us-east-1" }
        });

        const service = new LibraryDocsServiceImpl(app);

        expect(MockLambdaInvoker).toHaveBeenCalledTimes(2);
        const cppInvokerInstance = MockLambdaInvoker.mock.results[1]!.value;

        await service.startGeneration({
            orgId: "org-1",
            githubUrl: "https://github.com/test/repo",
            language: "CPP"
        });

        await vi.waitFor(() => {
            expect(mockDao.updateStatus).toHaveBeenCalledWith(expect.any(String), "COMPLETED");
        });

        expect(cppInvokerInstance.invoke).toHaveBeenCalled();
    });

    it("fails when C++ Lambda config is not provided", async () => {
        const { app, mockDao } = createMockApp({
            pythonLibraryDocsLambda: { functionName: "python-fn", region: "us-east-1" },
            cppLibraryDocsLambda: undefined
        });

        const service = new LibraryDocsServiceImpl(app);

        await service.startGeneration({
            orgId: "org-1",
            githubUrl: "https://github.com/test/repo",
            language: "CPP"
        });

        await vi.waitFor(() => {
            expect(mockDao.saveError).toHaveBeenCalled();
        });

        expect(mockDao.saveError).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                message: expect.stringContaining("C++ library docs Lambda is not configured")
            })
        );
        expect(mockDao.updateStatus).toHaveBeenCalledWith(expect.any(String), "FAILED");
    });

    it("fails when Python Lambda config is not provided", async () => {
        const { app, mockDao } = createMockApp({
            pythonLibraryDocsLambda: undefined,
            cppLibraryDocsLambda: { functionName: "cpp-fn", region: "us-east-1" }
        });

        const service = new LibraryDocsServiceImpl(app);

        await service.startGeneration({
            orgId: "org-1",
            githubUrl: "https://github.com/test/repo",
            language: "PYTHON"
        });

        await vi.waitFor(() => {
            expect(mockDao.saveError).toHaveBeenCalled();
        });

        expect(mockDao.saveError).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                message: expect.stringContaining("Python library docs Lambda is not configured")
            })
        );
        expect(mockDao.updateStatus).toHaveBeenCalledWith(expect.any(String), "FAILED");
    });
});
