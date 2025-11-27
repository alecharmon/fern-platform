/**
 * Shared environment configuration
 */

import { orchestratorEnv } from "./env.orchestrator";
import { workerEnv } from "./env.worker";

// Detect context: if orchestrator-specific env vars are present, use orchestrator config
const isOrchestrator = process.env.SQS_QUEUE_URL !== undefined;

export const env = isOrchestrator ? orchestratorEnv : workerEnv;
