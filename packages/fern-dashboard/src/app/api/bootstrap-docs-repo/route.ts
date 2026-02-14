import archiver from "archiver";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { fernCliConfig } from "@/utils/fernCliConfig";
import { stringifyYaml } from "@/utils/yaml";

const BootstrapDocsRepoRequest = z.object({
    openapiUrl: z.string().url(),
    marketingSite: z.string().url().optional(),
    organizationName: z.string().min(1)
});

type BootstrapDocsRepoRequestType = z.infer<typeof BootstrapDocsRepoRequest>;

interface OpenApiSpecResult {
    content: string;
    format: "json" | "yaml";
}

async function fetchOpenApiSpec(url: string): Promise<OpenApiSpecResult> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    const isJson = contentType.includes("json") || url.endsWith(".json");

    if (isJson) {
        try {
            const parsed = JSON.parse(text);
            return {
                content: JSON.stringify(parsed, null, 2),
                format: "json"
            };
        } catch {
            return { content: text, format: "yaml" };
        }
    }

    return { content: text, format: "yaml" };
}

function createDocsYmlContent(organizationName: string, marketingSite?: string): string {
    const config: Record<string, unknown> = {
        instances: [
            {
                url: `https://${organizationName}.${fernCliConfig.docsDomain}`
            }
        ],
        title: `${organizationName.charAt(0).toUpperCase() + organizationName.slice(1)} | Documentation`,
        navigation: [{ api: "API Reference", paginated: true }],
        colors: {
            accentPrimary: "#6366f1",
            background: "#ffffff"
        }
    };

    if (marketingSite) {
        config.tabs = {
            "marketing-site": {
                display_name: "Home",
                href: marketingSite
            }
        };
    }

    config["ai-search"] = {
        location: ["docs"]
    };

    return stringifyYaml(config);
}

function createFernConfigContent(organizationName: string): string {
    return JSON.stringify(
        {
            organization: organizationName,
            version: "0.57.0"
        },
        null,
        2
    );
}

function createGeneratorsYmlContent(openapiFileName: string): string {
    const config = {
        "default-group": "local",
        groups: {
            local: {
                generators: [
                    {
                        name: "fernapi/fern-typescript-sdk",
                        version: "latest",
                        output: {
                            location: "local-file-system",
                            path: "../sdks/typescript"
                        }
                    }
                ]
            }
        },
        api: {
            specs: [
                {
                    openapi: openapiFileName
                }
            ]
        }
    };

    return stringifyYaml(config);
}

function createReadmeContent(organizationName: string): string {
    return `# ${organizationName.charAt(0).toUpperCase() + organizationName.slice(1)} Documentation

This repository contains the Fern configuration for your API documentation.

## Getting Started

1. Install the Fern CLI:
   \`\`\`bash
   npm install -g fern-api
   \`\`\`

2. Generate your SDK:
   \`\`\`bash
   fern generate
   \`\`\`

3. Preview your documentation:
   \`\`\`bash
   fern docs dev
   \`\`\`

## Directory Structure

- \`fern/\` - Contains your Fern configuration
  - \`docs.yml\` - Documentation configuration
  - \`apis/api/\` - API workspace
    - \`openapi.yaml\` - Your OpenAPI specification
    - \`generators.yml\` - SDK generator configuration

## Learn More

- [Fern Documentation](https://buildwithfern.com/learn)
- [API Reference](https://buildwithfern.com/learn/api-reference)
`;
}

async function createZipArchive(
    organizationName: string,
    openapiSpec: string,
    openapiFileName: string,
    marketingSite?: string
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const archive = archiver("zip", {
            zlib: { level: 9 }
        });

        const chunks: Buffer[] = [];
        archive.on("data", (chunk) => chunks.push(chunk));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", reject);

        archive.append(createFernConfigContent(organizationName), {
            name: "fern.config.json"
        });

        archive.append(createReadmeContent(organizationName), {
            name: "README.md"
        });

        archive.append(createDocsYmlContent(organizationName, marketingSite), {
            name: "fern/docs.yml"
        });

        archive.append(openapiSpec, {
            name: `fern/apis/api/${openapiFileName}`
        });

        archive.append(createGeneratorsYmlContent(openapiFileName), {
            name: "fern/apis/api/generators.yml"
        });

        const gitignoreContent = `node_modules/
.env
.fern/
sdks/
*.log
.DS_Store
`;
        archive.append(gitignoreContent, {
            name: ".gitignore"
        });

        void archive.finalize();
    });
}

export const POST = withZodValidation(
    BootstrapDocsRepoRequest,
    async (req: NextRequest, validatedBody: BootstrapDocsRepoRequestType) => {
        try {
            const { openapiUrl, marketingSite, organizationName } = validatedBody;

            const { content: openapiSpec, format } = await fetchOpenApiSpec(openapiUrl);

            const openapiFileName = format === "json" ? "openapi.json" : "openapi.yaml";

            const zipBuffer = await createZipArchive(organizationName, openapiSpec, openapiFileName, marketingSite);

            return new NextResponse(zipBuffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/zip",
                    "Content-Disposition": `attachment; filename="${organizationName}-docs.zip"`
                }
            });
        } catch (error) {
            console.error("Error bootstrapping docs repo:", error);
            return NextResponse.json(
                {
                    error: "Failed to bootstrap docs repo",
                    message: error instanceof Error ? error.message : "Unknown error"
                },
                { status: 500 }
            );
        }
    }
);
