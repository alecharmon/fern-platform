import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { NextRequest } from "next/server";
import { extract } from "tar";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import postGitRepository from "@/app/services/dal/github/postGitRepository";
import { setFernTokenSecret } from "@/app/services/dal/github/setFernTokenSecret";
import { updateRepository } from "@/app/services/dal/github/updateRepository";
import { OnboardS3Service } from "@/app/services/onboarding-assets";
import { getPreCreateStatus } from "@/app/services/onboarding-prep/preCreateRepo";
import { fernCliConfig } from "@/utils/fernCliConfig";

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
                const normalizedDocsUrl = data.docsSiteUrl.includes(`.${fernCliConfig.docsDomain}`)
                    ? data.docsSiteUrl
                    : `${data.docsSiteUrl}.${fernCliConfig.docsDomain}`;

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
                const fernToken = session.accessToken;

                // The published URL is based on the docs site URL
                const publishedUrl = `https://${normalizedDocsUrl}`;

                // Update/create GitHub repo and trigger deployment workflow
                sendEvent({
                    type: "log",
                    message: "Setting up GitHub repository...",
                    timestamp: new Date().toISOString()
                });

                const s3Key = `fern_docs_${normalizedDocsUrl}.zip`;
                const createGithubRepo = true;

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

                    // GitHub repo update (use pre-created repo)
                    (async () => {
                        if (!createGithubRepo) {
                            return { success: false as const, githubRepoUrl: undefined };
                        }

                        try {
                            const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
                            if (!demoCreationBotOwner) {
                                console.error("FERN_DEMO_CREATION_BOT_OWNER not set");
                                return { success: false as const, githubRepoUrl: undefined };
                            }

                            // Wait for pre-created repo to be ready
                            let preCreateStatus = await getPreCreateStatus(data.orgName);

                            // If pre-creation is in progress, wait for it (poll every 2s, max 30s)
                            if (preCreateStatus?.status === "in_progress") {
                                sendEvent({
                                    type: "log",
                                    message: "Waiting for repository setup...",
                                    timestamp: new Date().toISOString()
                                });

                                const maxWaitMs = 30000;
                                const pollIntervalMs = 2000;
                                const startTime = Date.now();

                                while (
                                    preCreateStatus?.status === "in_progress" &&
                                    Date.now() - startTime < maxWaitMs
                                ) {
                                    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
                                    preCreateStatus = await getPreCreateStatus(data.orgName);
                                }
                            }

                            // Use pre-created repo if available
                            if (
                                preCreateStatus?.status === "completed" &&
                                preCreateStatus.repoUrl &&
                                preCreateStatus.repoName
                            ) {
                                sendEvent({
                                    type: "log",
                                    message: "Using pre-created repository...",
                                    timestamp: new Date().toISOString()
                                });

                                // Ensure FERN_TOKEN is set BEFORE pushing (push triggers workflow)
                                if (preCreateStatus.fernTokenSet) {
                                    sendEvent({
                                        type: "log",
                                        message: "✓ FERN_TOKEN already configured",
                                        timestamp: new Date().toISOString()
                                    });
                                } else {
                                    // Try to set FERN_TOKEN now if it wasn't set during pre-creation
                                    sendEvent({
                                        type: "log",
                                        message: "Setting up FERN_TOKEN...",
                                        timestamp: new Date().toISOString()
                                    });
                                    try {
                                        const tokenResult = await setFernTokenSecret({
                                            owner: demoCreationBotOwner,
                                            repoName: preCreateStatus.repoName,
                                            workingDir: tempDir,
                                            fernToken: fernToken
                                        });
                                        if (tokenResult.success) {
                                            sendEvent({
                                                type: "log",
                                                message: "✓ FERN_TOKEN generated and set in repository",
                                                timestamp: new Date().toISOString()
                                            });
                                        }
                                    } catch (tokenError) {
                                        console.warn("Failed to set FERN_TOKEN:", tokenError);
                                    }
                                }

                                // Read all files from the entire project
                                const files = await readAllFilesFromDirectory(tempDir);

                                // Push changes - this will trigger the workflow
                                const updateResult = await updateRepository({
                                    owner: demoCreationBotOwner,
                                    repoName: preCreateStatus.repoName,
                                    files,
                                    message: "Add documentation content"
                                });

                                if (updateResult.success) {
                                    sendEvent({
                                        type: "log",
                                        message: `✓ Updated GitHub repository: ${preCreateStatus.repoUrl}`,
                                        timestamp: new Date().toISOString()
                                    });

                                    // Deployment will auto-trigger via GitHub Actions (push to fern/ triggers workflow)
                                    sendEvent({
                                        type: "log",
                                        message: "✓ Deployment workflow will run automatically",
                                        timestamp: new Date().toISOString()
                                    });

                                    return {
                                        success: true as const,
                                        githubRepoUrl: preCreateStatus.repoUrl,
                                        fernToken: preCreateStatus.fernTokenSet ? "pre-created" : undefined
                                    };
                                } else {
                                    console.error("Failed to update pre-created repo:", updateResult.error);
                                    sendEvent({
                                        type: "log",
                                        message: "⚠ Failed to update GitHub repository",
                                        timestamp: new Date().toISOString()
                                    });
                                    return { success: false as const, githubRepoUrl: undefined };
                                }
                            }

                            // Fallback: create new repo if pre-creation failed or wasn't started
                            sendEvent({
                                type: "log",
                                message: "Creating GitHub repository...",
                                timestamp: new Date().toISOString()
                            });

                            const files = await readAllFilesFromDirectory(tempDir);
                            const repoName = data.orgName.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();

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

                                if (result.fernToken) {
                                    sendEvent({
                                        type: "log",
                                        message: "✓ FERN_TOKEN generated and set in repository",
                                        timestamp: new Date().toISOString()
                                    });
                                }

                                // Deployment will auto-trigger via GitHub Actions (push to fern/ triggers workflow)
                                sendEvent({
                                    type: "log",
                                    message: "✓ Deployment workflow will run automatically",
                                    timestamp: new Date().toISOString()
                                });

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
                            console.error("GitHub operation failed:", error);
                            sendEvent({
                                type: "log",
                                message: "⚠ Failed to set up GitHub repository",
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

                        if (result.ok) {
                            sendEvent({
                                type: "log",
                                message: "✓ Linked GitHub repository to docs site",
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            console.warn(`[Wizard] Failed to link GitHub metadata: ${result.error.type}`);
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
                // Note: The docs are being deployed asynchronously via GitHub Actions
                sendEvent({
                    type: "complete",
                    message: JSON.stringify({
                        url: publishedUrl,
                        fernDocsDownloadUrl: downloadUrl,
                        githubRepoUrl,
                        message: "Deployment started - your docs will be live shortly"
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
