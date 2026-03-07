/**
 * Returns the Fern CLI configuration based on the environment.
 *
 * When FERN_CLI_ENV=dev, uses the dev CLI package (@fern-api/fern-api-dev / fern-dev).
 * Otherwise, uses the production CLI package (fern-api / fern).
 *
 * NEXT_PUBLIC_FERN_CLI_ENV is checked first for client-side availability
 * (set via DefinePlugin in next.config.ts from FERN_CLI_ENV at build time).
 * FERN_CLI_ENV is checked as fallback for server-side runtime access.
 */

export interface FernCliConfig {
    npmPackage: string;
    cliCommand: string;
    docsDomain: string;
}

function getFernCliConfig(): FernCliConfig {
    if (process.env.NEXT_PUBLIC_FERN_CLI_ENV === "dev" || process.env.FERN_CLI_ENV === "dev") {
        return {
            npmPackage: "@fern-api/fern-api-dev",
            cliCommand: "fern-dev",
            docsDomain: "docs.dev.buildwithfern.com"
        };
    }
    return {
        npmPackage: "fern-api",
        cliCommand: "fern",
        docsDomain: "docs.buildwithfern.com"
    };
}

export const fernCliConfig = getFernCliConfig();
