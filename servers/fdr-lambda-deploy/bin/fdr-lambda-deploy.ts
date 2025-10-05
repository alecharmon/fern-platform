#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { EnvironmentType, type Environments } from "@fern-fern/fern-cloud-sdk/api/";

import { FdrLambdaDeployStack } from "../scripts/fdr-lambda-deploy-stack";

void main();

async function main() {
    const version = process.env["VERSION"];
    if (version === undefined) {
        throw new Error("Version is not specified!");
    }

    const isPreview = process.env["PREVIEW"] === "true";
    const prNumber = process.env["PR_NUMBER"];

    if (isPreview && !prNumber) {
        throw new Error("PR_NUMBER is required when PREVIEW=true");
    }

    const environments = await getEnvironments();
    const app = new cdk.App();

    // If preview mode, only deploy a preview stack
    if (isPreview) {
        const environmentInfo = environments[EnvironmentType.Dev2];
        if (environmentInfo == null) {
            throw new Error(`No info for environment Dev2`);
        }

        new FdrLambdaDeployStack(
            app,
            `fdr-lambda-preview-${prNumber}`,
            version,
            EnvironmentType.Dev2,
            environmentInfo,
            "sg-0158802587ada8261",
            {
                env: { account: "985111089818", region: "us-east-1" }
            },
            { isPreview: true, prNumber: prNumber! }
        );
        return;
    }

    // Normal deployment flow
    for (const [environmentType, environmentInfo] of Object.entries(environments)) {
        if (environmentInfo == null) {
            throw new Error(`No info for environment ${environmentType}`);
        }
        switch (environmentType) {
            case EnvironmentType.Dev:
            case EnvironmentType.Dev2:
                new FdrLambdaDeployStack(
                    app,
                    `fdr-lambda-${environmentType.toLowerCase()}`,
                    version,
                    environmentType,
                    environmentInfo,
                    "sg-0158802587ada8261",
                    {
                        env: { account: "985111089818", region: "us-east-1" }
                    }
                );
                break;
            case EnvironmentType.Prod:
                new FdrLambdaDeployStack(
                    app,
                    `fdr-lambda-${environmentType.toLowerCase()}`,
                    version,
                    environmentType,
                    environmentInfo,
                    "sg-c3cb3dd2",
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
    return (await response.json()) as Environments;
}
