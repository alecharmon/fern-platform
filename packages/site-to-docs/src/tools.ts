import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { tool } from "ai";
import { z } from "zod";

/**
 * Validates that a relative path doesn't escape the base directory.
 * @param relativePath - The relative path to validate
 * @param baseDir - The base directory (must be absolute)
 * @returns The resolved absolute path
 * @throws Error if path is absolute or escapes base directory
 */
function validatePath(relativePath: string, baseDir: string): string {
    // Reject absolute paths
    if (nodePath.isAbsolute(relativePath)) {
        throw new Error("Absolute paths not allowed");
    }
    // Resolve and ensure within base directory
    const resolved = nodePath.resolve(baseDir, relativePath);
    const normalizedBase = nodePath.resolve(baseDir);
    if (!resolved.startsWith(normalizedBase + nodePath.sep) && resolved !== normalizedBase) {
        throw new Error("Path escapes output directory");
    }
    return resolved;
}

/**
 * Creates tools bound to a specific output directory.
 * All filesystem operations are scoped to this directory.
 */
export function createTools(outputDir: string) {
    const absoluteOutputDir = nodePath.resolve(outputDir);

    return {
        /**
         * Mirrors native fetch() - returns response with status, headers, text
         */
        fetch: tool({
            description: "Fetch a URL. Returns status, headers, and body text.",
            parameters: z.object({
                url: z.string().url(),
                method: z.enum(["GET", "HEAD"]).default("GET").optional(),
                headers: z.record(z.string()).optional()
            }),
            execute: async ({ url, method = "GET", headers }) => {
                const response = await fetch(url, { method, headers });
                const body = method === "HEAD" ? "" : await response.text();
                return {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body
                };
            }
        }),

        /**
         * Mirrors fs.readFile - reads file relative to output directory
         */
        readFile: tool({
            description: "Read a file. Path must be relative to output directory.",
            parameters: z.object({
                path: z.string().describe("Relative path (no leading slash, no ..)")
            }),
            execute: async ({ path }) => {
                const absolutePath = validatePath(path, absoluteOutputDir);
                const content = await fs.readFile(absolutePath, "utf-8");
                return { content };
            }
        }),

        /**
         * Mirrors fs.writeFile - writes file relative to output directory
         */
        writeFile: tool({
            description:
                "Write a file. Path must be relative to output directory. Creates parent directories if needed.",
            parameters: z.object({
                path: z.string().describe("Relative path (no leading slash, no ..)"),
                content: z.string()
            }),
            execute: async ({ path, content }) => {
                const absolutePath = validatePath(path, absoluteOutputDir);
                // Create parent directories if they don't exist
                await fs.mkdir(nodePath.dirname(absolutePath), { recursive: true });
                await fs.writeFile(absolutePath, content, "utf-8");
                return { success: true, path: absolutePath };
            }
        }),

        /**
         * Mirrors fs.readdir - lists directory relative to output directory
         */
        readdir: tool({
            description: "List files in a directory. Path must be relative to output directory.",
            parameters: z.object({
                path: z.string().describe("Relative path (no leading slash, no ..)").default("")
            }),
            execute: async ({ path }) => {
                const absolutePath = validatePath(path || ".", absoluteOutputDir);
                const entries = await fs.readdir(absolutePath, { withFileTypes: true });
                return {
                    entries: entries.map((entry) => ({
                        name: entry.name,
                        isDirectory: entry.isDirectory()
                    }))
                };
            }
        })
    };
}

export type Tools = ReturnType<typeof createTools>;
