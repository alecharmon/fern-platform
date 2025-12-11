/**
 * Environment configuration for the orchestrator/delegator
 * Requires queue and ECS configuration to delegate jobs to workers
 */

function getEnvVar(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function getEnvVarArray(key: string): string[] {
    const value = getEnvVar(key);
    return value.split(",").map((v) => v.trim());
}

export const orchestratorEnv = {
    get sqsQueueUrl() {
        return getEnvVar("SQS_QUEUE_URL");
    },

    get awsRegion() {
        return process.env.AWS_REGION || "us-east-1";
    },
    get ecsClusterName() {
        return getEnvVar("ECS_CLUSTER_NAME");
    },
    get ecsEc2TaskDefinition() {
        return getEnvVar("ECS_EC2_TASK_DEFINITION");
    },
    get ecsFargateTaskDefinition() {
        return getEnvVar("ECS_FARGATE_TASK_DEFINITION");
    },
    get ecsCapacityProvider() {
        return getEnvVar("ECS_CAPACITY_PROVIDER");
    },
    get ecsWorkerContainerName() {
        return process.env.ECS_WORKER_CONTAINER_NAME || "fai-reindexing-delegated-worker";
    },
    get ecsSubnets() {
        return getEnvVarArray("ECS_SUBNETS");
    },
    get ecsSecurityGroups() {
        return getEnvVarArray("ECS_SECURITY_GROUPS");
    },

    get turbopufferApiKey() {
        return getEnvVar("TURBOPUFFER_API_KEY");
    },
    get openaiApiKey() {
        return getEnvVar("OPENAI_API_KEY");
    },
    get fernToken() {
        return getEnvVar("FERN_TOKEN");
    },

    get faiOrigin() {
        return process.env.FAI_ORIGIN || "https://fai.buildwithfern.com";
    },
    get fdrOrigin() {
        return process.env.FDR_ORIGIN || "https://registry.buildwithfern.com";
    },
    get fdrLambdaOrigin() {
        return process.env.FDR_LAMBDA_ORIGIN || "https://registry-v2.buildwithfern.com";
    },

    get fernDocsIndexName() {
        return process.env.FERN_DOCS_INDEX_NAME || "fern-docs";
    },

    get posthogApiKey() {
        return process.env.POSTHOG_API_KEY || "";
    },

    get environment() {
        return process.env.ENVIRONMENT || "dev";
    }
};
