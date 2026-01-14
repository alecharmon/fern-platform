import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { type ToolCallOptions, zodSchema } from "ai";
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

// Define input/output types for each tool
const fetchInputSchema = z.object({
    url: z.string().url(),
    method: z.enum(["GET", "HEAD"]).default("GET").optional(),
    headers: z.record(z.string()).optional()
});
type FetchInput = z.infer<typeof fetchInputSchema>;
type FetchOutput = { status: number; statusText: string; headers: Record<string, string>; body: string };

const readFileInputSchema = z.object({
    path: z.string().describe("Relative path (no leading slash, no ..)")
});
type ReadFileInput = z.infer<typeof readFileInputSchema>;
type ReadFileOutput = { content: string };

const writeFileInputSchema = z.object({
    path: z.string().describe("Relative path (no leading slash, no ..)"),
    content: z.string()
});
type WriteFileInput = z.infer<typeof writeFileInputSchema>;
type WriteFileOutput = { success: boolean; path: string };

const readdirInputSchema = z.object({
    path: z.string().describe("Relative path (no leading slash, no ..)").default("")
});
type ReaddirInput = z.infer<typeof readdirInputSchema>;
type ReaddirOutput = { entries: Array<{ name: string; isDirectory: boolean }> };

// Define a simple tool type that works with the ai SDK
interface SimpleTool<INPUT, OUTPUT> {
    description: string;
    inputSchema: ReturnType<typeof zodSchema>;
    execute: (input: INPUT, options: ToolCallOptions) => Promise<OUTPUT>;
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
        fetch: {
            description: "Fetch a URL. Returns status, headers, and body text.",
            inputSchema: zodSchema(fetchInputSchema),
            execute: async (input: FetchInput, _options: ToolCallOptions): Promise<FetchOutput> => {
                const { url, method = "GET", headers } = input;
                const response = await fetch(url, { method, headers });
                const body = method === "HEAD" ? "" : await response.text();
                return {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body
                };
            }
        } satisfies SimpleTool<FetchInput, FetchOutput>,

        /**
         * Mirrors fs.readFile - reads file relative to output directory
         */
        readFile: {
            description: "Read a file. Path must be relative to output directory.",
            inputSchema: zodSchema(readFileInputSchema),
            execute: async (input: ReadFileInput, _options: ToolCallOptions): Promise<ReadFileOutput> => {
                const absolutePath = validatePath(input.path, absoluteOutputDir);
                const content = await fs.readFile(absolutePath, "utf-8");
                return { content };
            }
        } satisfies SimpleTool<ReadFileInput, ReadFileOutput>,

        /**
         * Mirrors fs.writeFile - writes file relative to output directory
         */
        writeFile: {
            description:
                "Write a file. Path must be relative to output directory. Creates parent directories if needed.",
            inputSchema: zodSchema(writeFileInputSchema),
            execute: async (input: WriteFileInput, _options: ToolCallOptions): Promise<WriteFileOutput> => {
                const absolutePath = validatePath(input.path, absoluteOutputDir);
                // Create parent directories if they don't exist
                await fs.mkdir(nodePath.dirname(absolutePath), { recursive: true });
                await fs.writeFile(absolutePath, input.content, "utf-8");
                return { success: true, path: absolutePath };
            }
        } satisfies SimpleTool<WriteFileInput, WriteFileOutput>,

        /**
         * Mirrors fs.readdir - lists directory relative to output directory
         */
        readdir: {
            description: "List files in a directory. Path must be relative to output directory.",
            inputSchema: zodSchema(readdirInputSchema),
            execute: async (input: ReaddirInput, _options: ToolCallOptions): Promise<ReaddirOutput> => {
                const absolutePath = validatePath(input.path || ".", absoluteOutputDir);
                const entries = await fs.readdir(absolutePath, { withFileTypes: true });
                return {
                    entries: entries.map((entry) => ({
                        name: entry.name,
                        isDirectory: entry.isDirectory()
                    }))
                };
            }
        } satisfies SimpleTool<ReaddirInput, ReaddirOutput>
    };
}

export type Tools = ReturnType<typeof createTools>;
