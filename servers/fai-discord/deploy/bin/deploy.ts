#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";

import { type Environments, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/resources/environments";

import { FaiDiscordDeployStack } from "../src/deploy-stack";

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
                        TURBOPUFFER_API_KEY: getEnvVarOrThrow("TURBOPUFFER_API_KEY"),
                        OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
                        ANTHROPIC_API_KEY: getEnvVarOrThrow("ANTHROPIC_API_KEY"),
                        COHERE_API_KEY: getEnvVarOrThrow("COHERE_API_KEY"),
                        SLACK_CLIENT_ID: getEnvVarOrThrow("SLACK_CLIENT_ID"),
                        SLACK_CLIENT_SECRET: getEnvVarOrThrow("SLACK_CLIENT_SECRET"),
                        SLACK_SIGNING_SECRET: getEnvVarOrThrow("SLACK_SIGNING_SECRET"),
                        ASK_FERN_SLACK_BOT_TOKEN: getEnvVarOrThrow("ASK_FERN_SLACK_BOT_TOKEN"),
                        DISCORD_BOT_TOKEN: getEnvVarOrThrow("DISCORD_BOT_TOKEN"),
                        DISCORD_OAUTH_URL: getEnvVarOrThrow("DISCORD_OAUTH_URL"),
                        KV_REST_API_TOKEN: getEnvVarOrThrow("KV_REST_API_TOKEN"),
                        KV_REST_API_READ_ONLY_TOKEN: getEnvVarOrThrow("KV_REST_API_READ_ONLY_TOKEN"),
                        KV_REST_API_URL: getEnvVarOrThrow("KV_REST_API_URL")
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
                        TURBOPUFFER_API_KEY: getEnvVarOrThrow("TURBOPUFFER_API_KEY"),
                        OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
                        ANTHROPIC_API_KEY: getEnvVarOrThrow("ANTHROPIC_API_KEY"),
                        COHERE_API_KEY: getEnvVarOrThrow("COHERE_API_KEY"),
                        SLACK_CLIENT_ID: getEnvVarOrThrow("SLACK_CLIENT_ID"),
                        SLACK_CLIENT_SECRET: getEnvVarOrThrow("SLACK_CLIENT_SECRET"),
                        SLACK_SIGNING_SECRET: getEnvVarOrThrow("SLACK_SIGNING_SECRET"),
                        ASK_FERN_SLACK_BOT_TOKEN: getEnvVarOrThrow("ASK_FERN_SLACK_BOT_TOKEN"),
                        DISCORD_BOT_TOKEN: getEnvVarOrThrow("DISCORD_BOT_TOKEN"),
                        DISCORD_OAUTH_URL: getEnvVarOrThrow("DISCORD_OAUTH_URL"),
                        KV_REST_API_TOKEN: getEnvVarOrThrow("KV_REST_API_TOKEN"),
                        KV_REST_API_READ_ONLY_TOKEN: getEnvVarOrThrow("KV_REST_API_READ_ONLY_TOKEN"),
                        KV_REST_API_URL: getEnvVarOrThrow("KV_REST_API_URL")
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
                        TURBOPUFFER_API_KEY: getEnvVarOrThrow("TURBOPUFFER_API_KEY"),
                        OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
                        ANTHROPIC_API_KEY: getEnvVarOrThrow("ANTHROPIC_API_KEY"),
                        COHERE_API_KEY: getEnvVarOrThrow("COHERE_API_KEY"),
                        SLACK_CLIENT_ID: getEnvVarOrThrow("SLACK_CLIENT_ID"),
                        SLACK_CLIENT_SECRET: getEnvVarOrThrow("SLACK_CLIENT_SECRET"),
                        SLACK_SIGNING_SECRET: getEnvVarOrThrow("SLACK_SIGNING_SECRET"),
                        ASK_FERN_SLACK_BOT_TOKEN: getEnvVarOrThrow("ASK_FERN_SLACK_BOT_TOKEN"),
                        DISCORD_BOT_TOKEN: getEnvVarOrThrow("DISCORD_BOT_TOKEN"),
                        DISCORD_OAUTH_URL: getEnvVarOrThrow("DISCORD_OAUTH_URL"),
                        KV_REST_API_TOKEN: getEnvVarOrThrow("KV_REST_API_TOKEN"),
                        KV_REST_API_READ_ONLY_TOKEN: getEnvVarOrThrow("KV_REST_API_READ_ONLY_TOKEN"),
                        KV_REST_API_URL: getEnvVarOrThrow("KV_REST_API_URL")
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
