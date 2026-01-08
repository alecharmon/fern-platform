/**
 * Options for generating generators.yml
 */
export interface GeneratorsYmlOptions {
    /** Path to the OpenAPI spec file (relative to generators.yml). Defaults to "openapi.yml" */
    openapiPath?: string;
    /** Whether to include the schema reference comment. Defaults to true */
    includeSchema?: boolean;
}

/**
 * Generates the generators.yml content for the OpenAPI spec.
 *
 * @param options - Configuration options
 * @returns YAML string content for generators.yml
 */
export function generateGeneratorsYml(options: GeneratorsYmlOptions = {}): string {
    const { openapiPath = "openapi.yml", includeSchema = true } = options;

    let output = "";

    if (includeSchema) {
        output += "# yaml-language-server: $schema=https://schema.buildwithfern.dev/generators-yml.json\n\n";
    }

    output += `api:
  specs:
    - openapi: ${openapiPath}
`;

    return output;
}
