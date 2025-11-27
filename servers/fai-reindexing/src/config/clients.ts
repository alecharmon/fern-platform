import { SQSClient } from "@aws-sdk/client-sqs";
import { FernAIClient } from "@fern-api/fai-sdk";
import { FdrLambda, FdrLambdaClient } from "@fern-api/fdr-lambda-sdk";
import { env } from "./env";

/**
 * AWS SQS client for polling queue
 */
export const sqsClient = new SQSClient({ region: env.awsRegion });

/**
 * Fern AI client for index management
 */
export const faiClient = new FernAIClient({
    baseUrl: env.faiOrigin,
    token: env.fernToken
});

/**
 * FDR Lambda client for documentation metadata
 */
export const fdrLambdaClient = new FdrLambdaClient({
    environment: env.fdrLambdaOrigin,
    token: env.fernToken
});

export { FdrLambda };
