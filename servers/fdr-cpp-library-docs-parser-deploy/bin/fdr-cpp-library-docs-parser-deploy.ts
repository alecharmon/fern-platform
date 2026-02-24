import { type Environments, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/";
import * as cdk from "aws-cdk-lib";
import { FdrCppLibraryDocsParserStack } from "../scripts/fdr-cpp-library-docs-parser-stack";

void main();

async function main() {
    const version = process.env["VERSION"];
    if (version === undefined) {
        throw new Error("Version is not specified!");
    }

    const environments = await getEnvironments();
    const app = new cdk.App();

    for (const [environmentType, environmentInfo] of Object.entries(environments)) {
        if (environmentInfo == null) {
            throw new Error(`No info for environment ${environmentType}`);
        }
        switch (environmentType) {
            case EnvironmentType.Dev:
            case EnvironmentType.Dev2:
            case EnvironmentType.Prod:
                new FdrCppLibraryDocsParserStack(
                    app,
                    `fdr-cpp-library-docs-parser-${environmentType.toLowerCase()}`,
                    version,
                    environmentType,
                    environmentInfo,
                    {
                        env: { account: "985111089818", region: "us-east-1" }
                    }
                );
                break;
            default:
                return;
        }
    }
}

async function getEnvironments(): Promise<Environments> {
    const response = await fetch(
        "https://raw.githubusercontent.com/fern-api/fern-cloud/main/env-scoped-resources/environments.json",
        {
            method: "GET",
            headers: {
                Authorization: "Bearer " + process.env["GITHUB_TOKEN"]
            }
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `Failed to fetch environments from GitHub (${response.status} ${response.statusText}): ${text}`
        );
    }

    return (await response.json()) as Environments;
}
