import { orchestratorEnv } from "./config/env.orchestrator";
import { logger } from "./config/logger";
import { pollSQSQueue } from "./workers/queue";

export const env = orchestratorEnv;

logger.info("Starting FAI Reindexing Autoscaling Orchestrator", {
    sqsQueueUrl: env.sqsQueueUrl,
    ecsCluster: env.ecsClusterName,
    ecsEc2TaskDefinition: env.ecsEc2TaskDefinition,
    ecsFargateTaskDefinition: env.ecsFargateTaskDefinition,
    faiOrigin: env.faiOrigin,
    fdrOrigin: env.fdrOrigin
});

pollSQSQueue().catch((error) => {
    logger.error("Fatal error in orchestrator", { error });
    process.exit(1);
});
