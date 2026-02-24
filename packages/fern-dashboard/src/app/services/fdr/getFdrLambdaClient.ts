import { FdrLambdaClient } from "@fern-api/fdr-lambda-sdk";

function withDefaultProtocol(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }
    return `https://${url}`;
}

export function getFdrLambdaOrigin(): string {
    return withDefaultProtocol(process.env.NEXT_PUBLIC_FDR_LAMBDA_ORIGIN ?? "https://registry-v2.buildwithfern.com");
}

export function getFdrLambdaClient({ token }: { token: string }): FdrLambdaClient {
    return new FdrLambdaClient({
        environment: getFdrLambdaOrigin(),
        token
    });
}
