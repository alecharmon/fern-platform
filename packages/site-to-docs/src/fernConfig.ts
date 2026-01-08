/**
 * Options for generating fern.config.json
 */
export interface FernConfigOptions {
    /** Organization name */
    organization: string;
    /** Fern version. Defaults to "*" (latest) */
    version?: string;
}

/**
 * Generates the fern.config.json content.
 *
 * @param options - Configuration options
 * @returns JSON string content for fern.config.json
 */
export function generateFernConfigJson(options: FernConfigOptions): string {
    const { organization, version = "*" } = options;
    const config = {
        organization,
        version
    };
    return JSON.stringify(config, null, 2) + "\n";
}
