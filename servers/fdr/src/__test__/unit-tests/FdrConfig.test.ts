import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfig } from "../../app/FdrConfig";

describe("FdrConfig - C++ Lambda config", () => {
    const savedEnv: Record<string, string | undefined> = {};

    const BASE_ENV: Record<string, string> = {
        LOCAL_MODE_OVERRIDE: "true",
        MINIO_USERNAME: "test-user",
        MINIO_PASSWORD: "test-pass",
        MINIO_URL: "http://localhost:9000",
        MINIO_BUCKET_NAME: "test-bucket"
    };

    const CPP_ENV_VARS = [
        "CPP_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME",
        "CPP_LIBRARY_DOCS_LAMBDA_REGION",
        "CPP_LIBRARY_DOCS_LAMBDA_ENDPOINT"
    ];

    beforeEach(() => {
        for (const key of [...Object.keys(BASE_ENV), ...CPP_ENV_VARS]) {
            savedEnv[key] = process.env[key];
        }
        for (const [key, value] of Object.entries(BASE_ENV)) {
            process.env[key] = value;
        }
        for (const key of CPP_ENV_VARS) {
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    });

    it("includes cppLibraryDocsLambda when function name env var is set", () => {
        process.env.CPP_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME = "cpp-parser-fn";

        const config = getConfig();

        expect(config.cppLibraryDocsLambda).toBeDefined();
        expect(config.cppLibraryDocsLambda!.functionName).toBe("cpp-parser-fn");
    });

    it("returns undefined cppLibraryDocsLambda when function name env var is not set", () => {
        const config = getConfig();

        expect(config.cppLibraryDocsLambda).toBeUndefined();
    });

    it("defaults region to us-east-1 when only function name is set", () => {
        process.env.CPP_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME = "cpp-parser-fn";

        const config = getConfig();

        expect(config.cppLibraryDocsLambda).toBeDefined();
        expect(config.cppLibraryDocsLambda!.region).toBe("us-east-1");
        expect(config.cppLibraryDocsLambda!.endpoint).toBeUndefined();
    });

    it("populates all fields when all three CPP env vars are set", () => {
        process.env.CPP_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME = "cpp-parser-fn";
        process.env.CPP_LIBRARY_DOCS_LAMBDA_REGION = "eu-west-1";
        process.env.CPP_LIBRARY_DOCS_LAMBDA_ENDPOINT = "http://localhost:9001";

        const config = getConfig();

        expect(config.cppLibraryDocsLambda).toEqual({
            functionName: "cpp-parser-fn",
            region: "eu-west-1",
            endpoint: "http://localhost:9001"
        });
    });
});
