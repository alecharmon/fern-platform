import "server-only";

import yaml from "js-yaml";

export interface DocsYmlConfig {
    instances?: Array<{
        url: string;
        "custom-domain"?: string | string[];
        [key: string]: any;
    }>;
    products?: Array<{
        path?: string;
        [key: string]: any;
    }>;
    versions?: Array<{
        path?: string;
        [key: string]: any;
    }>;
}

export function parseUrlsFromDocsYml(yamlContent: string): string[] {
    try {
        const config = yaml.load(yamlContent) as DocsYmlConfig;
        if (!config?.instances || !Array.isArray(config.instances)) {
            return [];
        }

        return config.instances
            .filter(
                (instance): instance is { url: string; "custom-domain"?: string | string[] } =>
                    typeof instance === "object" &&
                    instance != null &&
                    "url" in instance &&
                    typeof instance.url === "string"
            )
            .flatMap((instance) => {
                const urls: string[] = [instance.url];

                if ("custom-domain" in instance && instance["custom-domain"]) {
                    const customDomain = instance["custom-domain"];

                    // Handle both string and array formats
                    if (typeof customDomain === "string") {
                        urls.push(customDomain);
                    } else if (Array.isArray(customDomain)) {
                        // Filter out non-string values and add all custom domains
                        urls.push(...customDomain.filter((domain): domain is string => typeof domain === "string"));
                    }
                }

                return urls;
            });
    } catch (error) {
        console.error("Failed to parse YAML content:", error);
        return [];
    }
}

export function extractReferencedYmlPaths(yamlContent: string): string[] {
    try {
        const config = yaml.load(yamlContent) as DocsYmlConfig;
        const paths: string[] = [];

        // Extract paths from products
        if (config?.products && Array.isArray(config.products)) {
            for (const product of config.products) {
                if (product?.path && typeof product.path === "string") {
                    paths.push(product.path);
                }
            }
        }

        // Extract paths from versions
        if (config?.versions && Array.isArray(config.versions)) {
            for (const version of config.versions) {
                if (version?.path && typeof version.path === "string") {
                    paths.push(version.path);
                }
            }
        }

        return paths;
    } catch (error) {
        console.error("Failed to parse YAML content for file references:", error);
        return [];
    }
}
