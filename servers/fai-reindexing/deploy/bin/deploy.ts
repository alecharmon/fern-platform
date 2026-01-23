#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";

import { type Environments, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/resources/environments";

import { FaiReindexingSchedulerStack } from "../src/reindexing-stack.js";

main().catch((error) => {
    // biome-ignore lint/suspicious/noConsole: Need to log deployment errors for debugging
    console.error("Deployment failed with error:", error);
    process.exit(1);
});

async function main() {
    const version = process.env["VERSION"];
    if (version === undefined) {
        throw new Error("Version is not specified!");
    }
    const environments = await getEnvironments();
    const app = new cdk.App();

    for (const environmentType of Object.keys(environments)) {
        switch (environmentType) {
            case EnvironmentType.Dev2: {
                const dev2Info = environments[environmentType];
                if (dev2Info == null) {
                    throw new Error("Unexpected error: dev2Info is undefined");
                }
                new FaiReindexingSchedulerStack(
                    app,
                    `fai-reindexing-scheduler-${environmentType.toLowerCase()}`,
                    version,
                    environmentType,
                    dev2Info,
                    {
                        env: { account: "985111089818", region: "us-east-1" }
                    }
                );
                break;
            }
            case EnvironmentType.Prod: {
                const prodInfo = environments[environmentType];
                if (prodInfo == null) {
                    throw new Error("Unexpected error: prodInfo is undefined");
                }
                new FaiReindexingSchedulerStack(
                    app,
                    `fai-reindexing-scheduler-${environmentType.toLowerCase()}`,
                    version,
                    environmentType,
                    prodInfo,
                    {
                        env: { account: "985111089818", region: "us-east-1" }
                    }
                );
                break;
            }
            default:
                continue;
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
        throw new Error(`Failed to fetch environments: ${response.status} ${response.statusText}`);
    }
    const environments = (await response.json()) as any as Environments;
    return environments;
}
