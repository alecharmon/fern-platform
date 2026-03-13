#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";

import { type Environments, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/resources/environments";

import { FaiDiscordDeployStack } from "../src/deploy-discord-stack";

void main();

async function main() {
    const version = process.env["VERSION"];
    if (version === undefined) {
        throw new Error("Version is not specified!");
    }
    const environments = await getEnvironments();
    const app = new cdk.App();
    for (const environmentType of Object.keys(environments)) {
        switch (environmentType) {
            case EnvironmentType.Dev: {
                const devInfo = environments[environmentType];
                if (devInfo == null) {
                    throw new Error("Unexpected error: devInfo is undefined");
                }
                new FaiDiscordDeployStack(
                    app,
                    `fai-discord-${environmentType.toLowerCase()}`,
                    version,
                    environmentType,
                    devInfo,
                    {
                        ANTHROPIC_API_KEY: getEnvVarOrThrow("ANTHROPIC_API_KEY"),
                        OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
                        TURBOPUFFER_API_KEY: getEnvVarOrThrow("TURBOPUFFER_API_KEY"),
                        POSTGRES_DATABASE_URL: getEnvVarOrThrow("POSTGRES_DATABASE_URL"),
                        DISCORD_BOT_TOKEN: getEnvVarOrThrow("DISCORD_BOT_TOKEN"),
                        DISCORD_OAUTH_URL: getEnvVarOrThrow("DISCORD_OAUTH_URL"),
                        ORG_AI_CREDIT_CHECK_ORG_IDS: getEnvVarOrThrow("ORG_AI_CREDIT_CHECK_ORG_IDS"),
                        DASHBOARD_API_URL: getEnvVarOrThrow("DASHBOARD_API_URL"),
                        JWT_SECRET_KEY: getEnvVarOrThrow("JWT_SECRET_KEY")
                    },
                    {
                        env: { account: "985111089818", region: "us-east-1" }
                    }
                );
                break;
            }
            case EnvironmentType.Dev2: {
                const dev2Info = environments[environmentType];
                if (dev2Info == null) {
                    throw new Error("Unexpected error: dev2Info is undefined");
                }
                new FaiDiscordDeployStack(
                    app,
                    `fai-discord-${environmentType.toLowerCase()}`,
                    version,
                    environmentType,
                    dev2Info,
                    {
                        ANTHROPIC_API_KEY: getEnvVarOrThrow("ANTHROPIC_API_KEY"),
                        OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
                        TURBOPUFFER_API_KEY: getEnvVarOrThrow("TURBOPUFFER_API_KEY"),
                        POSTGRES_DATABASE_URL: getEnvVarOrThrow("POSTGRES_DATABASE_URL"),
                        DISCORD_BOT_TOKEN: getEnvVarOrThrow("DISCORD_BOT_TOKEN"),
                        DISCORD_OAUTH_URL: getEnvVarOrThrow("DISCORD_OAUTH_URL"),
                        ORG_AI_CREDIT_CHECK_ORG_IDS: getEnvVarOrThrow("ORG_AI_CREDIT_CHECK_ORG_IDS"),
                        DASHBOARD_API_URL: getEnvVarOrThrow("DASHBOARD_API_URL"),
                        JWT_SECRET_KEY: getEnvVarOrThrow("JWT_SECRET_KEY")
                    },
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
                new FaiDiscordDeployStack(
                    app,
                    `fai-discord-${environmentType.toLowerCase()}`,
                    version,
                    environmentType,
                    prodInfo,
                    {
                        ANTHROPIC_API_KEY: getEnvVarOrThrow("ANTHROPIC_API_KEY"),
                        OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
                        TURBOPUFFER_API_KEY: getEnvVarOrThrow("TURBOPUFFER_API_KEY"),
                        POSTGRES_DATABASE_URL: getEnvVarOrThrow("POSTGRES_DATABASE_URL"),
                        DISCORD_BOT_TOKEN: getEnvVarOrThrow("DISCORD_BOT_TOKEN"),
                        DISCORD_OAUTH_URL: getEnvVarOrThrow("DISCORD_OAUTH_URL"),
                        ORG_AI_CREDIT_CHECK_ORG_IDS: getEnvVarOrThrow("ORG_AI_CREDIT_CHECK_ORG_IDS"),
                        DASHBOARD_API_URL: getEnvVarOrThrow("DASHBOARD_API_URL"),
                        JWT_SECRET_KEY: getEnvVarOrThrow("JWT_SECRET_KEY")
                    },
                    {
                        env: { account: "985111089818", region: "us-east-1" }
                    }
                );
                break;
            }
            default:
                return;
        }
    }
}

function getEnvVarOrThrow(envVarName: string): string {
    const val = process.env[envVarName];
    if (val != null) {
        return val;
    }
    throw Error("Expected environment variable to be defined: " + envVarName);
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
    const environments = (await response.json()) as any as Environments;
    return environments;
}
