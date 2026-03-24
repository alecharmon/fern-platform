#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";

import { type Environments, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/resources/environments";

import { FaiChatEcsStack } from "../src/fai-chat-ecs-stack";

void main();

async function main() {
    const version = process.env["VERSION"];
    if (version === undefined) {
        throw new Error("VERSION is not specified!");
    }

    const isPreview = process.env["PREVIEW"] === "true";
    const prNumber = process.env["PR_NUMBER"];

    if (isPreview && !prNumber) {
        throw new Error("PR_NUMBER is required for preview deployments");
    }

    const environments = await getEnvironments();
    const app = new cdk.App();

    if (isPreview) {
        const dev2Info = environments[EnvironmentType.Dev2];
        if (dev2Info == null) {
            throw new Error("Dev2 environment info not found");
        }

        new FaiChatEcsStack(app, `fai-chat-preview-${prNumber}`, {
            version,
            environmentType: EnvironmentType.Dev2,
            environmentInfo: dev2Info,
            isPreview: true,
            prNumber: prNumber!,
            env: { account: "985111089818", region: "us-east-1" }
        });
    } else {
        const deployTarget = process.env.DEPLOY_ENVIRONMENT?.toLowerCase();
        if (!deployTarget) {
            throw new Error("DEPLOY_ENVIRONMENT must be set for non-preview deployments");
        }

        for (const environmentType of Object.keys(environments)) {
            // Only synthesize the stack we're actually deploying.
            // This avoids needing placeholder secrets for non-target stacks.
            if (environmentType.toLowerCase() !== deployTarget) {
                continue;
            }

            const envInfo = environments[environmentType as EnvironmentType];
            if (envInfo == null) {
                continue;
            }

            new FaiChatEcsStack(app, `fai-chat-${environmentType.toLowerCase()}`, {
                version,
                environmentType: environmentType as EnvironmentType,
                environmentInfo: envInfo,
                isPreview: false,
                env: { account: "985111089818", region: "us-east-1" }
            });
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
    const environments = (await response.json()) as Environments;
    return environments;
}
