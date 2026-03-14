import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import * as Sentry from "@sentry/node";
import type { Logger } from "winston";
import { RETRY_CONFIG } from "../config/constants";
import { orchestratorEnv as env } from "../config/env.orchestrator";
import type { ReindexJobMessage } from "../types";

const ecsClient = new ECSClient({ region: env.awsRegion });

export interface ECSTaskOptions {
    memory: number;
    cpu: number;
    jobMessage: ReindexJobMessage;
    sqsMessageId: string;
}

function calculateFargateCpuMemory(memoryMB: number): { cpu: string; memory: string } {
    const roundedMemory = Math.ceil(memoryMB / 1024) * 1024;

    let cpu: string;
    let memory = roundedMemory;

    if (memory <= 2048) {
        cpu = "512";
        if (memory < 1024) {
            memory = 1024;
        }
    } else if (memory <= 4096) {
        cpu = "1024";
    } else if (memory <= 8192) {
        cpu = "2048";
    } else if (memory <= 16384) {
        cpu = "2048";
    } else {
        cpu = "4096";
        if (memory > 30720) {
            memory = 30720;
        }
    }

    return { cpu, memory: memory.toString() };
}

export async function delegateToWorkerTask(
    options: ECSTaskOptions,
    log: Logger
): Promise<{ taskArn: string; launchType: "EC2" | "Fargate" }> {
    const { memory, cpu, jobMessage, sqsMessageId } = options;

    log.info("Delegating job to ECS worker task", {
        domain: jobMessage.domain,
        memoryMB: memory,
        cpuUnits: cpu,
        sqsMessageId
    });

    try {
        const taskArn = await runOnEC2(options, log);
        return { taskArn, launchType: "EC2" };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (
            errorMessage.includes("RESOURCE:MEMORY") ||
            errorMessage.includes("RESOURCE:CPU") ||
            errorMessage.includes("No container instance met all")
        ) {
            Sentry.addBreadcrumb({
                category: "ecs",
                message: "EC2 capacity exhausted, falling back to Fargate",
                level: "warning",
                data: { domain: jobMessage.domain, memoryMB: memory, sqsMessageId }
            });
            log.warn("EC2 capacity exhausted, falling back to Fargate", {
                domain: jobMessage.domain,
                memoryMB: memory,
                sqsMessageId,
                reason: errorMessage.includes("RESOURCE:CPU") ? "CPU exhaustion" : "Memory exhaustion"
            });

            const taskArn = await runOnFargate(options, log);
            return { taskArn, launchType: "Fargate" };
        }

        Sentry.captureException(error, {
            tags: { component: "ecs-delegator", operation: "delegate_task", domain: jobMessage.domain },
            extra: { memoryMB: memory, cpuUnits: cpu, sqsMessageId }
        });
        throw error;
    }
}

function buildSharedEnvVars(
    jobMessage: ReindexJobMessage,
    sqsMessageId: string,
    nodeOptions: string,
    launchType: "EC2" | "Fargate"
): Array<{ name: string; value: string }> {
    const envVars = [
        { name: "AWS_REGION", value: env.awsRegion },
        { name: "TURBOPUFFER_API_KEY", value: env.turbopufferApiKey },
        { name: "OPENAI_API_KEY", value: env.openaiApiKey },
        { name: "FERN_TOKEN", value: env.fernToken },
        { name: "FAI_ORIGIN", value: env.faiOrigin },
        { name: "FDR_ORIGIN", value: env.fdrOrigin },
        { name: "FDR_LAMBDA_ORIGIN", value: env.fdrLambdaOrigin },
        { name: "FERN_DOCS_INDEX_NAME", value: env.fernDocsIndexName },
        { name: "POSTHOG_API_KEY", value: env.posthogApiKey ?? "" },
        { name: "ENVIRONMENT", value: env.environment },
        { name: "LAUNCH_TYPE", value: launchType },
        { name: "NODE_OPTIONS", value: nodeOptions },
        { name: "SOURCE_SQS_MESSAGE_ID", value: sqsMessageId },
        { name: "REINDEX_DOMAIN", value: jobMessage.domain },
        { name: "REINDEX_BASEPATH", value: jobMessage.basepath ?? "" },
        { name: "FORCE_FULL_REINDEX", value: String(jobMessage.forceFullReindex ?? false) },
        { name: "REINDEX_JOB_ID", value: jobMessage.jobId ?? "" },
        { name: "FAI_SENTRY_DSN", value: process.env.FAI_SENTRY_DSN ?? "" }
    ];

    // Add EDGE_CONFIG if available (needed for auth configuration)
    if (env.edgeConfig) {
        envVars.push({ name: "EDGE_CONFIG", value: env.edgeConfig });
    }

    // Add DOCS_DEFINITION_S3_BUCKET_NAME if available (needed for S3-based docs loading)
    if (env.docsDefinitionS3BucketName) {
        envVars.push({ name: "DOCS_DEFINITION_S3_BUCKET_NAME", value: env.docsDefinitionS3BucketName });
    }

    return envVars;
}

function buildSharedTags(
    jobMessage: ReindexJobMessage,
    sqsMessageId: string,
    memory: string,
    cpu: string,
    launchType: "EC2" | "Fargate"
): Array<{ key: string; value: string }> {
    return [
        { key: "Service", value: "fai-reindexing-worker" },
        { key: "Domain", value: jobMessage.domain },
        { key: "SqsMessageId", value: sqsMessageId },
        { key: "MemoryMB", value: memory },
        { key: "CpuUnits", value: cpu },
        { key: "LaunchType", value: launchType },
        { key: "Environment", value: env.environment }
    ];
}

async function runOnEC2(options: ECSTaskOptions, log: Logger): Promise<string> {
    const { memory, cpu, jobMessage, sqsMessageId } = options;

    const nodeOptions = `--max-old-space-size=${Math.floor(memory * 0.875)} --expose-gc`;
    const envVars = buildSharedEnvVars(jobMessage, sqsMessageId, nodeOptions, "EC2");
    const tags = buildSharedTags(jobMessage, sqsMessageId, memory.toString(), cpu.toString(), "EC2");

    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
        try {
            const command = new RunTaskCommand({
                cluster: env.ecsClusterName,
                taskDefinition: env.ecsEc2TaskDefinition,
                count: 1,
                startedBy: "fai-reindexing-scheduler",
                capacityProviderStrategy: [
                    {
                        capacityProvider: env.ecsCapacityProvider,
                        weight: 1,
                        base: 0
                    }
                ],
                overrides: {
                    containerOverrides: [
                        {
                            name: env.ecsWorkerContainerName,
                            environment: envVars,
                            cpu: cpu, // CPU units for the container
                            memoryReservation: memory, // Soft limit for scheduling
                            memory: memory // Hard limit for isolation
                        }
                    ]
                },
                tags
            });

            const response = await ecsClient.send(command);

            if (response.failures && response.failures.length > 0) {
                const resourceMemoryFailure = response.failures.some(
                    (f) => f.reason === "RESOURCE:MEMORY" || f.reason?.includes("No container instance")
                );

                if (resourceMemoryFailure) {
                    throw new Error(`RESOURCE:MEMORY: ${JSON.stringify(response.failures)}`);
                }

                log.warn(`EC2 launch attempt ${attempt} failed, retrying...`, {
                    domain: jobMessage.domain,
                    failures: response.failures,
                    attempt
                });

                if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
                    await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.ECS_RETRY_DELAY_MS));
                    continue;
                }

                throw new Error(`EC2 RunTask failed after ${attempt} attempts: ${JSON.stringify(response.failures)}`);
            }

            if (!response.tasks || response.tasks.length === 0) {
                throw new Error("EC2 RunTask returned no tasks");
            }

            const taskArn = response.tasks[0].taskArn!;

            log.info("Successfully launched task on EC2", {
                domain: jobMessage.domain,
                taskArn,
                memoryMB: memory,
                cpuUnits: cpu,
                sqsMessageId,
                attempt
            });

            return taskArn;
        } catch (error) {
            if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
                Sentry.captureException(error, {
                    tags: { component: "ecs-delegator", operation: "run_ec2", domain: jobMessage.domain },
                    extra: { memoryMB: memory, cpuUnits: cpu, sqsMessageId, attempt }
                });
                throw error;
            }
        }
    }

    throw new Error(`EC2 RunTask failed after ${RETRY_CONFIG.MAX_ATTEMPTS} attempts`);
}

async function runOnFargate(options: ECSTaskOptions, log: Logger): Promise<string> {
    const { memory, jobMessage, sqsMessageId } = options;

    const fargateResources = calculateFargateCpuMemory(memory);

    log.info("Launching task on Fargate", {
        domain: jobMessage.domain,
        requestedMemoryMB: memory,
        allocatedMemoryMB: fargateResources.memory,
        cpu: fargateResources.cpu,
        sqsMessageId
    });

    const nodeOptions = `--max-old-space-size=${Math.floor(Number.parseInt(fargateResources.memory) * 0.875)} --expose-gc`;
    const envVars = buildSharedEnvVars(jobMessage, sqsMessageId, nodeOptions, "Fargate");
    const tags = buildSharedTags(jobMessage, sqsMessageId, fargateResources.memory, fargateResources.cpu, "Fargate");

    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
        try {
            const command = new RunTaskCommand({
                cluster: env.ecsClusterName,
                taskDefinition: env.ecsFargateTaskDefinition,
                launchType: "FARGATE",
                count: 1,
                startedBy: "fai-reindexing-scheduler",
                networkConfiguration: {
                    awsvpcConfiguration: {
                        subnets: env.ecsSubnets,
                        securityGroups: env.ecsSecurityGroups,
                        assignPublicIp: "ENABLED"
                    }
                },
                overrides: {
                    cpu: fargateResources.cpu,
                    memory: fargateResources.memory,
                    containerOverrides: [
                        {
                            name: env.ecsWorkerContainerName,
                            environment: envVars
                        }
                    ]
                },
                tags
            });

            const response = await ecsClient.send(command);

            if (response.failures && response.failures.length > 0) {
                log.warn(`Fargate launch attempt ${attempt} failed, retrying...`, {
                    domain: jobMessage.domain,
                    failures: response.failures,
                    attempt
                });

                if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
                    await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.ECS_RETRY_DELAY_MS));
                    continue;
                }

                throw new Error(
                    `Fargate RunTask failed after ${attempt} attempts: ${JSON.stringify(response.failures)}`
                );
            }

            if (!response.tasks || response.tasks.length === 0) {
                throw new Error("Fargate RunTask returned no tasks");
            }

            const taskArn = response.tasks[0].taskArn!;

            log.info("Successfully launched task on Fargate", {
                domain: jobMessage.domain,
                taskArn,
                memoryMB: fargateResources.memory,
                cpu: fargateResources.cpu,
                sqsMessageId,
                attempt
            });

            return taskArn;
        } catch (error) {
            if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
                Sentry.captureException(error, {
                    tags: { component: "ecs-delegator", operation: "run_fargate", domain: jobMessage.domain },
                    extra: { memoryMB: memory, sqsMessageId, attempt }
                });
                log.error(`Failed to launch task on Fargate after ${RETRY_CONFIG.MAX_ATTEMPTS} attempts`, {
                    domain: jobMessage.domain,
                    error: error instanceof Error ? error.message : String(error),
                    sqsMessageId
                });
            }
        }
    }

    throw new Error(`Fargate RunTask failed after ${RETRY_CONFIG.MAX_ATTEMPTS} attempts`);
}
