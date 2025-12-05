import "server-only";

import type { FernConfigJsonErrors, GetFernConfigJsonResult, ValidateAccessResult } from "@fern-api/docs-loader";
import z from "zod";

export const fernConfigSchema = z.object({
    organization: z.string(),
    version: z.string()
});

export interface FernConfigStructure {
    organization: string;
    version: string;
}

export interface ValidationContext {
    owner: string;
    repo: string;
    site: string;
    orgName: string;
    fernConfigResult: GetFernConfigJsonResult;
}

export function validateFernConfigOrganization(context: ValidationContext): ValidateAccessResult {
    if (context.fernConfigResult.type === "error") {
        // Map fern config errors to access errors
        const fernError = context.fernConfigResult.error;
        switch (fernError.type) {
            case "FERN_CONFIG_JSON_MISSING":
                return {
                    type: "error",
                    error: { type: "CONFIG_MISSING" }
                };
            case "FERN_CONFIG_JSON_MALFORMED":
                return {
                    type: "error",
                    error: {
                        type: "CONFIG_MALFORMED",
                        message: fernError.parsingErrorMessage
                    }
                };
            default:
                return {
                    type: "error",
                    error: {
                        type: "UNEXPECTED_ERROR",
                        message: `Failed to fetch config: ${fernError.type}`
                    }
                };
        }
    }

    const fernConfig = context.fernConfigResult.result;

    // Verify organization matches
    if (fernConfig.organization !== context.orgName) {
        return {
            type: "error",
            error: {
                type: "CONFIG_ORG_MISMATCH",
                expected: context.orgName,
                actual: fernConfig.organization
            }
        };
    }

    return { type: "ok" };
}

export function parseFernConfig(content: string): {
    organization: string;
    version: string;
    pathToFernConfigJson?: string;
} | null {
    try {
        const parsedContent = JSON.parse(content);
        const maybeConfig = fernConfigSchema.safeParse(parsedContent);

        if (!maybeConfig.success) {
            console.error("Failed to parse fern.config.json:", maybeConfig.error);
            return null;
        }

        return maybeConfig.data;
    } catch (error) {
        console.error("Failed to parse fern.config.json:", error);
        return null;
    }
}

export function createFernConfigError(
    errorType: FernConfigJsonErrors["type"],
    message?: string
): GetFernConfigJsonResult {
    if (errorType === "FERN_CONFIG_JSON_MALFORMED" && message) {
        return {
            type: "error",
            error: {
                type: "FERN_CONFIG_JSON_MALFORMED",
                parsingErrorMessage: message
            }
        };
    }

    return {
        type: "error",
        error: { type: errorType } as FernConfigJsonErrors
    };
}
