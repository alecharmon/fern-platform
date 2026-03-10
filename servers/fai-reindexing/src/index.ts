import * as Sentry from "@sentry/node";
import { orchestratorEnv } from "./config/env.orchestrator";
import { logger } from "./config/logger";
import { initSentry } from "./config/sentry";
import { pollSQSQueue } from "./workers/queue";

initSentry("fai-reindexing-orchestrator");

export const env = orchestratorEnv;

logger.info("Starting FAI Reindexing Autoscaling Orchestrator", {
    sqsQueueUrl: env.sqsQueueUrl,
    ecsCluster: env.ecsClusterName,
    ecsEc2TaskDefinition: env.ecsEc2TaskDefinition,
    ecsFargateTaskDefinition: env.ecsFargateTaskDefinition,
    faiOrigin: env.faiOrigin,
    fdrOrigin: env.fdrOrigin
});

pollSQSQueue().catch(async (error) => {
    Sentry.captureException(error, { tags: { component: "orchestrator" } });
    logger.error("Fatal error in orchestrator", { error });
    await Sentry.flush(2000);
    process.exit(1);
});
