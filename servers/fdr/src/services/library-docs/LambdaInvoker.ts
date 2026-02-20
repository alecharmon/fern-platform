import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

export interface LambdaInvokePayload {
    jobId: string;
    githubUrl: string;
    language: string;
    branch?: string;
    packagePath?: string;
}

export interface LambdaInvokeResult {
    status: "success" | "error";
    irS3Key?: string;
    error?: { code: string; message: string };
}

export interface LambdaInvokerConfig {
    functionName: string;
    region: string;
    endpoint?: string; // For local development (Docker RIE)
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
    };
}

export class LambdaInvoker {
    private client: LambdaClient;
    private functionName: string;

    constructor(config: LambdaInvokerConfig) {
        this.functionName = config.functionName;
        this.client = new LambdaClient({
            region: config.region,
            ...(config.endpoint && { endpoint: config.endpoint }),
            ...(config.credentials && { credentials: config.credentials })
        });
    }

    async invoke(payload: LambdaInvokePayload): Promise<LambdaInvokeResult> {
        const command = new InvokeCommand({
            FunctionName: this.functionName,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload)
        });

        const response = await this.client.send(command);

        if (response.FunctionError) {
            return {
                status: "error",
                error: {
                    code: "LAMBDA_FUNCTION_ERROR",
                    message: response.FunctionError
                }
            };
        }

        if (!response.Payload) {
            return {
                status: "error",
                error: {
                    code: "LAMBDA_NO_RESPONSE",
                    message: "Lambda returned no payload"
                }
            };
        }

        const result = JSON.parse(new TextDecoder().decode(response.Payload)) as LambdaInvokeResult;
        return result;
    }
}
