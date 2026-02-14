/**
 * Returns the Fern CLI configuration based on the environment.
 *
 * When FERN_CLI_ENV=dev, uses the dev CLI package (@fern-api/fern-api-dev / fern-dev).
 * Otherwise, uses the production CLI package (fern-api / fern).
 */

interface FernCliConfig {
    npmPackage: string;
    cliCommand: string;
}

function getFernCliConfig(): FernCliConfig {
    if (process.env.FERN_CLI_ENV === "dev") {
        return {
            npmPackage: "@fern-api/fern-api-dev",
            cliCommand: "fern-dev"
        };
    }
    return {
        npmPackage: "fern-api",
        cliCommand: "fern"
    };
}

export const fernCliConfig = getFernCliConfig();
