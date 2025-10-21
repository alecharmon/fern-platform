/* eslint-disable turbo/no-undeclared-env-vars */

export function getFdrLambdaUrl(): string {
    if (process.env.FDR_LAMBDA_URL == null) {
        throw new Error("FDR_LAMBDA_URL is not defined in the current environment");
    }
    return process.env.FDR_LAMBDA_URL;
}
