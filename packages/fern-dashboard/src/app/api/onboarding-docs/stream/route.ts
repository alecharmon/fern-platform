import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { NextRequest } from "next/server";
import { extract } from "tar";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import postGitRepository from "@/app/services/dal/github/postGitRepository";
import { OnboardS3Service } from "@/app/services/onboarding-assets";

import type { OnboardingDocsRequest } from "../types";
import { createFernProject } from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180; // 3 minutes

/**
 * Checks if a file is binary based on its extension
 * Note: SVG is excluded because it's text-based XML
 */
function isBinaryFile(filePath: string): boolean {
    const binaryExtensions = new Set([
        // Images (binary formats only)
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".ico",
        ".bmp",
        ".webp",
        ".tiff",
        ".tif",
        // Other binary formats
        ".pdf",
        ".zip",
        ".tar",
        ".gz",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".otf"
    ]);

    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.has(ext);
}

async function readAllFilesFromDirectory(
    dirPath: string
): Promise<Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>> {
    const files: Array<{
        path: string;
        content: string;
        encoding?: "utf-8" | "base64";
    }> = [];

    // Files and directories to exclude from GitHub upload
    // Note: .github is NOT excluded because we want to include the workflows
    const excludePatterns = [".git", "node_modules", ".DS_Store", ".claude"];

    async function readDir(currentPath: string, relativePath = "") {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            // Skip excluded files/directories
            if (excludePatterns.includes(entry.name)) {
                continue;
            }

            const fullPath = path.join(currentPath, entry.name);
            const relPath = path.join(relativePath, entry.name);

            if (entry.isDirectory()) {
                await readDir(fullPath, relPath);
            } else {
                // Read binary files as base64 to preserve their integrity
                if (isBinaryFile(fullPath)) {
                    const buffer = await fs.readFile(fullPath);
                    files.push({
                        path: relPath,
                        content: buffer.toString("base64"),
                        encoding: "base64"
                    });
                } else {
                    const content = await fs.readFile(fullPath, "utf-8");
                    files.push({ path: relPath, content });
                }
            }
        }
    }

    await readDir(dirPath);
    return files;
}

export async function GET(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const dataStr = searchParams.get("data");

    if (!sessionId || !dataStr) {
        return new Response("Session ID and data required", { status: 400 });
    }

    let data;
    try {
        data = JSON.parse(decodeURIComponent(dataStr));
    } catch {
        return new Response("Invalid data format", { status: 400 });
    }

    // Note: Authorization for orgName access is handled by the session middleware
    // The user must be authenticated and have access to the org to reach this endpoint

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: { type: string; message: string; timestamp: string }) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            let tempDir: string | null = null;

            try {
                // Send immediate log to show streaming has started
                sendEvent({
                    type: "log",
                    message: "Starting documentation generation...",
                    timestamp: new Date().toISOString()
                });

                // Create temporary directory
                tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-stream-"));

                // Normalize the docs URL
                const normalizedDocsUrl = data.docsSiteUrl.includes(".docs.buildwithfern.com")
                    ? data.docsSiteUrl
                    : `${data.docsSiteUrl}.docs.buildwithfern.com`;

                // Download docs-starter repo as tarball
                sendEvent({
                    type: "log",
                    message: "Cloning docs-starter repository...",
                    timestamp: new Date().toISOString()
                });

                // Download from GitHub tarball API (faster and doesn't require git)
                const tarballUrl = "https://github.com/fern-api/docs-starter/archive/refs/heads/main.tar.gz";
                const response = await fetch(tarballUrl);

                if (!response.ok) {
                    throw new Error(`Failed to download docs-starter: ${response.statusText}`);
                }

                // Save tarball to temp file
                const tarballPath = path.join(tempDir, "docs-starter.tar.gz");
                const tarballBuffer = Buffer.from(await response.arrayBuffer());
                await fs.writeFile(tarballPath, tarballBuffer);

                sendEvent({
                    type: "log",
                    message: "Extracting repository...",
                    timestamp: new Date().toISOString()
                });

                // Extract tarball using tar npm package (pure JavaScript, works in Vercel)
                await extract({
                    file: tarballPath,
                    cwd: tempDir,
                    strip: 1
                });

                // Clean up tarball
                await fs.unlink(tarballPath);

                sendEvent({
                    type: "log",
                    message: "✓ Repository cloned successfully",
                    timestamp: new Date().toISOString()
                });

                // Customize the cloned project with user data
                sendEvent({
                    type: "log",
                    message: "Injecting config data into project...",
                    timestamp: new Date().toISOString()
                });

                await createFernProject(data as OnboardingDocsRequest, tempDir);

                const fernDir = path.join(tempDir, "fern");

                sendEvent({
                    type: "log",
                    message: "Running fern generate --docs...",
                    timestamp: new Date().toISOString()
                });

                const fernToken = session.accessToken;
                const env = {
                    ...process.env,
                    ...(fernToken && { FERN_TOKEN: fernToken }),
                    npm_config_cache: "/tmp/.npm",
                    NPM_CONFIG_CACHE: "/tmp/.npm"
                };

                // Spawn the process to get streaming output
                const child = spawn(
                    "sh",
                    [
                        "-c",
                        'echo "y" | npx fern-api@latest upgrade -y ; npx fern-api@latest generate --docs --no-prompt'
                    ],
                    {
                        cwd: tempDir,
                        env,
                        shell: true
                    }
                );

                // Stream stdout
                child.stdout.on("data", (data) => {
                    const lines = data
                        .toString()
                        .split("\n")
                        .filter((line: string) => line.trim());
                    for (const line of lines) {
                        sendEvent({
                            type: "log",
                            message: line,
                            timestamp: new Date().toISOString()
                        });
                    }
                });

                // Stream stderr
                child.stderr.on("data", (data) => {
                    const lines = data
                        .toString()
                        .split("\n")
                        .filter((line: string) => line.trim());
                    for (const line of lines) {
                        sendEvent({
                            type: "log",
                            message: line,
                            timestamp: new Date().toISOString()
                        });
                    }
                });

                // Wait for process to complete and capture output
                let cliOutput = "";
                const cliOutputLines: string[] = [];

                child.stdout.on("data", (data) => {
                    cliOutput += data.toString();
                    cliOutputLines.push(data.toString());
                });

                child.stderr.on("data", (data) => {
                    cliOutput += data.toString();
                });

                await new Promise<void>((resolve, reject) => {
                    child.on("close", (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Process exited with code ${code}`));
                        }
                    });

                    child.on("error", (error) => {
                        reject(error);
                    });

                    // Timeout after 3 minutes
                    setTimeout(() => {
                        child.kill();
                        reject(new Error("Process timeout"));
                    }, 180000);
                });

                // Parse the published URL from CLI output
                const urlMatch = cliOutput.match(/Published docs to (https:\/\/[^\s]+)/);
                if (!urlMatch) {
                    throw new Error("Failed to parse published URL from Fern CLI output");
                }
                const publishedUrl = urlMatch[1];

                sendEvent({
                    type: "log",
                    message: `✓ Published docs to ${publishedUrl}`,
                    timestamp: new Date().toISOString()
                });

                // Now do S3 upload and GitHub operations in parallel
                sendEvent({
                    type: "log",
                    message: "Uploading to S3 and creating GitHub repository...",
                    timestamp: new Date().toISOString()
                });

                const s3Key = `fern_docs_${normalizedDocsUrl}.zip`;
                const createGithubRepo = true; // Default to true for streaming

                const [s3Result, githubResult] = await Promise.all([
                    // S3 upload
                    OnboardS3Service.zipAndUploadDirectory({
                        directoryPath: fernDir,
                        key: s3Key
                    }).catch((error) => {
                        console.error("S3 upload failed:", error);
                        sendEvent({
                            type: "log",
                            message: "⚠ S3 upload failed (non-critical)",
                            timestamp: new Date().toISOString()
                        });
                        return { downloadUrl: "" };
                    }),

                    // GitHub repo creation
                    (async () => {
                        if (!createGithubRepo) {
                            return { success: false as const, githubRepoUrl: undefined };
                        }

                        try {
                            // Read all files from the entire project (including README.md at root)
                            const files = await readAllFilesFromDirectory(tempDir);

                            const repoName = data.docsSiteUrl.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
                            const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;

                            if (!demoCreationBotOwner) {
                                console.error("FERN_DEMO_CREATION_BOT_OWNER not set");
                                return { success: false as const, githubRepoUrl: undefined };
                            }

                            const result = await postGitRepository({
                                orgName: data.orgName,
                                owner: demoCreationBotOwner,
                                repoName,
                                description: `Documentation for ${data.docsSiteName}`,
                                isPrivate: true,
                                files,
                                site: normalizedDocsUrl,
                                setFernToken: {
                                    workingDir: tempDir,
                                    fernToken: fernToken
                                }
                            });

                            if (result.success) {
                                sendEvent({
                                    type: "log",
                                    message: `✓ Created GitHub repository: ${result.htmlUrl}`,
                                    timestamp: new Date().toISOString()
                                });

                                // Check if FERN_TOKEN was successfully generated and set
                                if (result.fernToken) {
                                    sendEvent({
                                        type: "log",
                                        message: "✓ FERN_TOKEN generated and set in repository",
                                        timestamp: new Date().toISOString()
                                    });
                                } else {
                                    sendEvent({
                                        type: "log",
                                        message: "⚠ Failed to set FERN_TOKEN secret (non-critical)",
                                        timestamp: new Date().toISOString()
                                    });
                                }

                                return {
                                    success: true as const,
                                    githubRepoUrl: result.htmlUrl,
                                    fernToken: result.fernToken
                                };
                            } else {
                                sendEvent({
                                    type: "log",
                                    message: "⚠ Failed to create GitHub repository",
                                    timestamp: new Date().toISOString()
                                });
                                return { success: false as const, githubRepoUrl: undefined };
                            }
                        } catch (error) {
                            console.error("GitHub creation failed:", error);
                            sendEvent({
                                type: "log",
                                message: "⚠ Failed to create GitHub repository",
                                timestamp: new Date().toISOString()
                            });
                            return { success: false as const, githubRepoUrl: undefined };
                        }
                    })()
                ]);

                const { downloadUrl } = s3Result;
                const githubRepoUrl = githubResult.githubRepoUrl;

                if (downloadUrl) {
                    sendEvent({
                        type: "log",
                        message: "✓ Uploaded to S3",
                        timestamp: new Date().toISOString()
                    });
                }

                // Link GitHub repo to docs site if created
                if (githubRepoUrl && session.accessToken) {
                    try {
                        const postDocsGithubSourceHandler = (await import("@/app/api/post-docs-github-source/handler"))
                            .default;

                        const result = await postDocsGithubSourceHandler({
                            url: normalizedDocsUrl,
                            token: session.accessToken,
                            githubUrl: githubRepoUrl
                        });

                        if (result.success) {
                            sendEvent({
                                type: "log",
                                message: "✓ Linked GitHub repository to docs site",
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            console.warn(`[Wizard] Failed to link GitHub metadata: ${result.error}`);
                            sendEvent({
                                type: "log",
                                message: "⚠ Failed to link GitHub metadata (non-critical - repo created successfully)",
                                timestamp: new Date().toISOString()
                            });
                        }
                    } catch (error) {
                        console.error("Failed to link GitHub repo:", error);
                        sendEvent({
                            type: "log",
                            message: "⚠ Failed to link GitHub repository (non-critical)",
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                // Send completion event with all results
                sendEvent({
                    type: "complete",
                    message: JSON.stringify({
                        url: publishedUrl,
                        fernDocsDownloadUrl: downloadUrl,
                        githubRepoUrl,
                        message: "Documentation published successfully"
                    }),
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                sendEvent({
                    type: "error",
                    message: error instanceof Error ? error.message : "Unknown error occurred",
                    timestamp: new Date().toISOString()
                });
            } finally {
                // Cleanup
                if (tempDir) {
                    try {
                        await fs.rm(tempDir, { recursive: true, force: true });
                    } catch (cleanupError) {
                        console.error("Failed to cleanup temp directory:", cleanupError);
                    }
                }
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
        }
    });
}
