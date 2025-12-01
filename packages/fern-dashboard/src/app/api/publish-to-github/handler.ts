"use server";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { RepositoryFile } from "@fern-api/docs-loader";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import unzipper from "unzipper";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import postGitRepository from "@/app/services/dal/github/postGitRepository";

export interface PublishToGithubRequest {
    orgName: Auth0OrgName;
    docsSiteUrl: string;
    docsSiteName: string;
    fernDocsDownloadUrl: string;
}

/**
 * Downloads a zip from S3, extracts it, and creates a GitHub repository with the files
 */
export default async function handler(data: PublishToGithubRequest): Promise<
    | {
          data: {
              githubRepoUrl: string;
              message: string;
          };
      }
    | {
          error: string;
      }
> {
    let tempDir: string | undefined;

    try {
        // Create temporary directory
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-publish-"));

        // Parse the S3 URL to get bucket and key
        const s3Url = new URL(data.fernDocsDownloadUrl);
        const bucketName = process.env.ONBOARDING_ASSETS_S3_BUCKET_NAME;
        if (!bucketName) {
            throw new Error("ONBOARDING_ASSETS_S3_BUCKET_NAME environment variable is not set");
        }

        // Extract key from the URL path (remove leading slash)
        const s3Key = s3Url.pathname.substring(1);

        // Download the zip from S3
        const s3Client = new S3Client({});
        const getObjectResponse = await s3Client.send(
            new GetObjectCommand({
                Bucket: bucketName,
                Key: s3Key
            })
        );

        if (!getObjectResponse.Body) {
            throw new Error("No body in S3 response");
        }

        // Save the zip file
        const zipPath = path.join(tempDir, "fern-docs.zip");
        const fsSync = await import("fs");
        const writeStream = fsSync.createWriteStream(zipPath);
        await finished(Readable.from(getObjectResponse.Body as any).pipe(writeStream));

        // Extract the zip file
        const extractDir = path.join(tempDir, "extracted");
        await fs.mkdir(extractDir, { recursive: true });

        // Use a streaming unzip approach
        await new Promise((resolve, reject) => {
            fsSync
                .createReadStream(zipPath)
                .pipe(unzipper.Extract({ path: extractDir }))
                .on("close", resolve)
                .on("error", reject);
        });

        // Read all files from the extracted directory
        const files = await readAllFilesFromDirectory(extractDir);

        console.log(`Extracted ${files.length} files from zip`);
        if (files.length > 0) {
            console.log(
                "Sample files:",
                files.slice(0, 5).map((f) => ({ path: f.path, size: f.content.length, encoding: f.encoding }))
            );
        }

        // Log binary files specifically
        const binaryFiles = files.filter((f) => f.encoding === "base64");
        if (binaryFiles.length > 0) {
            console.log(
                `Found ${binaryFiles.length} binary files:`,
                binaryFiles.map((f) => f.path)
            );
        }

        if (files.length === 0) {
            throw new Error("No files found in extracted zip");
        }

        // Create a repository name from the docs site URL
        const repoName = data.docsSiteUrl.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase() + "-docs-buildwithfern-com";

        // Use the demo creation bot's GitHub username/org from environment variable
        // This should be the username or org that owns the FERN_DEMO_CREATION_BOT_TOKEN
        const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;

        if (!demoCreationBotOwner) {
            console.error("FERN_DEMO_CREATION_BOT_OWNER environment variable is not set");
            throw new Error("GitHub repository owner not configured");
        }

        // Create GitHub repository using postGitRepository which handles org auth
        const githubResult = await postGitRepository({
            orgName: data.orgName,
            owner: demoCreationBotOwner,
            repoName,
            description: `Fern documentation for ${data.docsSiteName}`,
            isPrivate: true,
            files,
            site: `${data.docsSiteUrl}.docs.buildwithfern.com`
        });

        if (!githubResult.success) {
            console.error("Failed to create GitHub repository:", githubResult.error);
            throw new Error("Failed to create GitHub repository");
        }

        return {
            data: {
                githubRepoUrl: githubResult.htmlUrl,
                message: "Successfully published to GitHub"
            }
        };
    } catch (error) {
        console.error("Error in publish-to-github handler:", error);
        return {
            error: error instanceof Error ? error.message : "An unexpected error occurred"
        };
    } finally {
        // Clean up temporary directory
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (error) {
                console.error("Failed to clean up temp directory:", error);
            }
        }
    }
}

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

/**
 * Recursively reads all files from a directory and returns them as RepositoryFile objects
 */
async function readAllFilesFromDirectory(dirPath: string, basePath: string = dirPath): Promise<RepositoryFile[]> {
    const files: RepositoryFile[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
            const subFiles = await readAllFilesFromDirectory(fullPath, basePath);
            files.push(...subFiles);
        } else {
            // Read binary files as base64 to preserve their integrity
            if (isBinaryFile(fullPath)) {
                const buffer = await fs.readFile(fullPath);
                files.push({
                    path: relativePath,
                    content: buffer.toString("base64"),
                    encoding: "base64"
                });
            } else {
                const content = await fs.readFile(fullPath, "utf-8");
                files.push({
                    path: relativePath,
                    content
                });
            }
        }
    }

    return files;
}
