/**
 * Returns the Fern CLI configuration based on the environment.
 *
 * When FERN_CLI_ENV=dev, uses the dev CLI package (@fern-api/fern-api-dev / fern-dev).
 * Otherwise, uses the production CLI package (fern-api / fern).
 */

interface FernCliConfig {
    npmPackage: string;
    cliCommand: string;
    docsDomain: string;
}

function getFernCliConfig(): FernCliConfig {
    if (process.env.FERN_CLI_ENV === "dev") {
        return {
            npmPackage: "@fern-api/fern-api-dev",
            cliCommand: "fern-dev",
            docsDomain: "dev.docs.buildwithfern.com"
        };
    }
    return {
        npmPackage: "fern-api",
        cliCommand: "fern",
        docsDomain: "docs.buildwithfern.com"
    };
}

export const fernCliConfig = getFernCliConfig();
