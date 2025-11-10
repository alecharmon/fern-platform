#!/usr/bin/env tsx

/**
 * Standalone performance test script for Fern self-hosted container
 *
 * Usage:
 *   tsx perf-test.ts [options]
 *
 * Options:
 *   --fern-path <path>       Path to fern folder to mount (default: ../fern)
 *   --image-version <version> Version of fernapi/fern-self-hosted to pull from DockerHub (requires DOCKERHUB_PASSWORD env var or --dockerhub-password)
 *   --mount-folders <paths>  Paths to additional folders to mount (will be mounted at /folderName, comma-separated)
 *   --iterations <n>         Number of test iterations (default: 1)
 *   --output <path>         Output directory for reports (default: ../../.local/performance-reports)
 *   --collect-stats         Collect Docker stats during test
 *   --logs                  Stream container logs to console
 *   --docker-username <username> DockerHub username for authentication (default: fernapi)
 *   --dockerhub-password <password> DockerHub password (takes precedence over DOCKERHUB_PASSWORD env var)
 *   --help                  Show this help message
 */

import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs";
import os from "os";
import path from "path";

// Set up CLI with commander
const program = new Command();

program
    .name("perf-test")
    .description("Performance test script for Fern self-hosted container")
    .option("--fern-path <path>", "Path to fern folder to mount", path.resolve(__dirname, "../fern"))
    .option("--image-version <version>", "Version of fernapi/fern-self-hosted to pull from DockerHub")
    .option(
        "--mount-folders <paths>",
        "Paths to additional folders to mount (will be mounted at /folderName, comma-separated)"
    )
    .option("--iterations <n>", "Number of test iterations", "1")
    .option("--output <path>", "Output directory for reports", "../../.local/performance-reports")
    .option("--collect-stats", "Collect Docker stats during test", false)
    .option("--logs", "Stream container logs to console", false)
    .option("--docker-username <username>", "DockerHub username for authentication", "fernapi")
    .option("--dockerhub-password <password>", "DockerHub password (takes precedence over DOCKERHUB_PASSWORD env var)")
    .parse(process.argv);

const options = program.opts();

const CONTAINER_NAME = "fern-self-hosted-perf-test";
const FERN_PATH = path.resolve(options.fernPath);
const IMAGE_VERSION = options.imageVersion;
const MOUNT_FOLDERS = options.mountFolders
    ? options.mountFolders.split(",").map((p: string) => path.resolve(p.trim()))
    : [];
const ITERATIONS = parseInt(options.iterations);
const OUTPUT_DIR = path.resolve(options.output);
const COLLECT_STATS = options.collectStats;
const SHOW_LOGS = options.logs;

// Types
interface ServiceTiming {
    name: string;
    duration: number;
    status: "ready" | "failed";
}

interface DockerStats {
    timestamp: number;
    cpuPercent: number;
    memoryUsageMB: number;
    memoryLimitMB: number;
}

interface PerformanceMetrics {
    totalStartupTime: number;
    services: ServiceTiming[];
    dockerStats: DockerStats[];
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getDockerPlatform(): string {
    const arch = os.arch();

    // Map Node.js arch to Docker platform
    if (arch === "arm64") {
        return "linux/arm64";
    } else if (arch === "x64") {
        return "linux/amd64";
    } else {
        // Default to amd64 for other architectures
        console.log(chalk.yellow(`  ⚠️  Unknown architecture ${arch}, defaulting to linux/amd64`));
        return "linux/amd64";
    }
}

async function authenticateDockerHub(dockerUsername: string, dockerHubPassword: string): Promise<void> {
    console.log(chalk.cyan("\n🔐 Authenticating with DockerHub..."));

    try {
        await execa("docker", ["login", "-u", dockerUsername, "--password-stdin"], {
            input: dockerHubPassword
        });
        console.log(chalk.green("  ✓ Successfully authenticated with DockerHub"));
    } catch (error) {
        throw new Error(`Failed to authenticate with DockerHub: ${error}`);
    }
}

async function pullDockerImage(version: string): Promise<string> {
    const imageName = `fernapi/fern-self-hosted:${version}`;
    const platform = getDockerPlatform();

    console.log(chalk.cyan(`\n📥 Pulling Docker image from DockerHub...`));
    console.log(chalk.dim(`  Image: ${imageName}`));
    console.log(chalk.dim(`  Platform: ${platform}`));

    try {
        await execa("docker", ["pull", "--platform", platform, imageName], { stdio: "inherit" });
        console.log(chalk.green(`  ✓ Successfully pulled ${imageName}`));
        return imageName;
    } catch (error) {
        throw new Error(`Failed to pull Docker image: ${error}`);
    }
}

async function removeContainer(): Promise<void> {
    try {
        await execa("docker", ["rm", "-f", CONTAINER_NAME]);
    } catch {
        // Container doesn't exist, that's fine
    }
}

async function startContainer(imageName: string): Promise<void> {
    console.log(chalk.cyan("\n🐳 Starting Docker container..."));
    console.log(chalk.dim(`  Container: ${CONTAINER_NAME}`));
    console.log(chalk.dim(`  Image: ${imageName}`));
    console.log(chalk.dim(`  Fern path: ${FERN_PATH}`));

    const dockerArgs = [
        "run",
        "--name",
        CONTAINER_NAME,
        "-d",
        "-p",
        "5435:5432",
        "-p",
        "8082:8080",
        "-p",
        "9003:9000",
        "-p",
        "3002:3000",
        "-p",
        "7702:7700",
        "-v",
        `${FERN_PATH}:/fern`
    ];

    // Add additional volume mounts if specified
    const usedMountTargets = new Map<string, string>();
    for (const mountFolder of MOUNT_FOLDERS) {
        const folderName = path.basename(mountFolder);
        const targetPath = `/${folderName}`;

        // Check for basename collisions
        if (usedMountTargets.has(targetPath)) {
            const conflictingPath = usedMountTargets.get(targetPath)!;
            throw new Error(
                `Mount collision detected: Both "${conflictingPath}" and "${mountFolder}" ` +
                    `would mount to the same container path "${targetPath}". ` +
                    `Please rename folders or use different source paths to avoid conflicts.`
            );
        }

        usedMountTargets.set(targetPath, mountFolder);
        console.log(chalk.dim(`  Mount folder: ${mountFolder} -> ${targetPath}`));
        dockerArgs.push("-v", `${mountFolder}:${targetPath}`);
    }

    dockerArgs.push(imageName);

    console.log(chalk.dim(`Running docker command: docker ${dockerArgs.join(" ")}`));
    await execa("docker", dockerArgs);

    console.log(chalk.green("  ✓ Container started"));
}

async function getContainerId(): Promise<string> {
    const { stdout } = await execa("docker", ["ps", "-q", "-f", `name=${CONTAINER_NAME}`]);
    return stdout.trim();
}

function colorizeLog(line: string): string {
    const lowerLine = line.toLowerCase();

    // PostgreSQL - Blue
    if (lowerLine.includes("postgres") || lowerLine.includes("pg_") || lowerLine.includes("database system")) {
        return chalk.blue(line);
    }

    // MinIO - Yellow
    if (lowerLine.includes("minio") || lowerLine.includes("s3") || lowerLine.includes("object storage")) {
        return chalk.yellow(line);
    }

    // MeiliSearch - Magenta
    if (lowerLine.includes("meilisearch") || lowerLine.includes("meili") || lowerLine.includes("search engine")) {
        return chalk.magenta(line);
    }

    // FDR - Cyan
    if (lowerLine.includes("fdr") || lowerLine.includes("fern definition registry") || lowerLine.includes("prisma")) {
        return chalk.cyan(line);
    }

    // Docs/Next.js - Green
    if (lowerLine.includes("docs") || lowerLine.includes("next") || lowerLine.includes("fern generate")) {
        return chalk.green(line);
    }

    // Errors - Red
    if (lowerLine.includes("error") || lowerLine.includes("failed") || lowerLine.includes("fatal")) {
        return chalk.red(line);
    }

    // Warnings - Yellow
    if (lowerLine.includes("warn") || lowerLine.includes("warning")) {
        return chalk.yellow(line);
    }

    // Success messages - Green
    if (
        lowerLine.includes("ready") ||
        lowerLine.includes("success") ||
        lowerLine.includes("complete") ||
        lowerLine.includes("started")
    ) {
        return chalk.green(line);
    }

    // Default - Gray for generic logs
    return chalk.gray(line);
}

async function streamLogs(): Promise<void> {
    if (!SHOW_LOGS) {
        return;
    }

    const logStream = execa("docker", ["logs", "-f", CONTAINER_NAME]);

    if (logStream.stdout) {
        logStream.stdout.on("data", (data: Buffer) => {
            const lines = data
                .toString()
                .split("\n")
                .filter((line) => line.trim());
            lines.forEach((line) => {
                const coloredLine = colorizeLog(line);
                console.log(`${chalk.dim("[Container]")} ${coloredLine}`);
            });
        });
    }

    if (logStream.stderr) {
        logStream.stderr.on("data", (data: Buffer) => {
            const lines = data
                .toString()
                .split("\n")
                .filter((line) => line.trim());
            lines.forEach((line) => {
                const coloredLine = colorizeLog(line);
                console.log(`${chalk.dim("[Container]")} ${coloredLine}`);
            });
        });
    }
}

async function collectDockerStats(): Promise<DockerStats | null> {
    try {
        const { stdout } = await execa("docker", ["stats", CONTAINER_NAME, "--no-stream", "--format", "{{json .}}"]);

        const stats = JSON.parse(stdout);

        const parseMemory = (mem: string): number => {
            const match = mem.match(/^([\d.]+)([KMGT]i?B)?$/i);
            if (!match) {
                return 0;
            }

            const value = parseFloat(match[1]);
            const unit = match[2]?.toUpperCase() || "B";

            const multipliers: { [key: string]: number } = {
                B: 1,
                KB: 1024,
                KIB: 1024,
                MB: 1024 * 1024,
                MIB: 1024 * 1024,
                GB: 1024 * 1024 * 1024,
                GIB: 1024 * 1024 * 1024
            };

            return value * (multipliers[unit] || 1);
        };

        const [memUsage, memLimit] = stats.MemUsage.split(" / ").map(parseMemory);

        return {
            timestamp: Date.now(),
            cpuPercent: parseFloat(stats.CPUPerc.replace("%", "")),
            memoryUsageMB: memUsage / (1024 * 1024),
            memoryLimitMB: memLimit / (1024 * 1024)
        };
    } catch {
        return null;
    }
}

function isSuccessfulStatusCode(statusCode: string): boolean {
    const code = parseInt(statusCode);
    // Accept 2xx (success) and 3xx (redirect) status codes as successful
    return code >= 200 && code < 400;
}

async function waitForService(url: string, containerId: string, maxAttempts: number = 60): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const { stdout } = await execa(
                "docker",
                ["exec", containerId, "curl", "-f", "-s", "-o", "/dev/null", "-w", "%{http_code}", url],
                { reject: false }
            );

            if (isSuccessfulStatusCode(stdout)) {
                return true;
            }
        } catch {
            // Service not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return false;
}

async function measureStartup(): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    const services: ServiceTiming[] = [];
    const dockerStats: DockerStats[] = [];

    console.log(chalk.yellow("\n⏱️  Measuring startup performance...\n"));

    // Start log streaming if requested
    await streamLogs();

    // Start stats collection if requested
    let statsInterval: NodeJS.Timeout | undefined;
    if (COLLECT_STATS) {
        console.log(chalk.dim("📊 Stats collection enabled\n"));
        statsInterval = setInterval(async () => {
            const stats = await collectDockerStats();
            if (stats) {
                dockerStats.push(stats);
            }
        }, 1000);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const containerId = await getContainerId();
    if (!containerId) {
        throw new Error(`Container ${CONTAINER_NAME} not found`);
    }

    // Monitor PostgreSQL
    console.log(chalk.blue("🔵 Waiting for PostgreSQL..."));
    const pgStart = Date.now();
    let pgReady = false;
    for (let i = 0; i < 30; i++) {
        try {
            const { exitCode } = await execa(
                "docker",
                ["exec", containerId, "pg_isready", "-U", "postgres", "-d", "postgres"],
                { reject: false }
            );

            if (exitCode === 0) {
                pgReady = true;
                break;
            }
        } catch {
            // Not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    services.push({
        name: "postgresql",
        duration: Date.now() - pgStart,
        status: pgReady ? "ready" : "failed"
    });

    if (pgReady) {
        console.log(chalk.green(`  ✓ PostgreSQL ready (${((Date.now() - pgStart) / 1000).toFixed(2)}s)`));
    } else {
        console.log(chalk.red(`  ✗ PostgreSQL failed`));
    }

    // Monitor MinIO
    console.log(chalk.yellow("\n🟡 Waiting for MinIO..."));
    const minioStart = Date.now();
    const minioReady = await waitForService("http://localhost:9000/minio/health/live", containerId, 30);
    services.push({
        name: "minio",
        duration: Date.now() - minioStart,
        status: minioReady ? "ready" : "failed"
    });

    if (minioReady) {
        console.log(chalk.green(`  ✓ MinIO ready (${((Date.now() - minioStart) / 1000).toFixed(2)}s)`));
    } else {
        console.log(chalk.red(`  ✗ MinIO failed`));
    }

    // Monitor MeiliSearch
    console.log(chalk.magenta("\n🟣 Waiting for MeiliSearch..."));
    const meiliStart = Date.now();
    const meiliReady = await waitForService("http://localhost:7700/health", containerId, 30);
    services.push({
        name: "meilisearch",
        duration: Date.now() - meiliStart,
        status: meiliReady ? "ready" : "failed"
    });

    if (meiliReady) {
        console.log(chalk.green(`  ✓ MeiliSearch ready (${((Date.now() - meiliStart) / 1000).toFixed(2)}s)`));
    } else {
        console.log(chalk.red(`  ✗ MeiliSearch failed`));
    }

    // Monitor FDR
    console.log(chalk.cyan("\n🔷 Waiting for FDR..."));
    const fdrStart = Date.now();
    const fdrReady = await waitForService("http://localhost:8080/health", containerId, 60);
    services.push({
        name: "fdr",
        duration: Date.now() - fdrStart,
        status: fdrReady ? "ready" : "failed"
    });

    if (fdrReady) {
        console.log(chalk.green(`  ✓ FDR ready (${((Date.now() - fdrStart) / 1000).toFixed(2)}s)`));
    } else {
        console.log(chalk.red(`  ✗ FDR failed`));
    }

    // Monitor Docs UI
    console.log(chalk.green("\n🟢 Waiting for Docs UI..."));
    const docsStart = Date.now();
    const docsReady = await waitForService("http://localhost:3000", containerId, 60);
    services.push({
        name: "docs-ui",
        duration: Date.now() - docsStart,
        status: docsReady ? "ready" : "failed"
    });

    if (docsReady) {
        console.log(chalk.green(`  ✓ Docs UI ready (${((Date.now() - docsStart) / 1000).toFixed(2)}s)`));
    } else {
        console.log(chalk.red(`  ✗ Docs UI failed`));
    }

    // Stop stats collection
    if (statsInterval) {
        clearInterval(statsInterval);
    }

    const totalStartupTime = Date.now() - startTime;

    return {
        totalStartupTime,
        services,
        dockerStats
    };
}

function generateReport(metrics: PerformanceMetrics[], iteration?: number): string {
    const title = iteration ? `Iteration ${iteration} Report` : "Performance Test Summary";
    let report = `# ${title}\n\n`;
    report += `**Test Date:** ${new Date().toISOString()}\n`;
    report += `**Iterations:** ${metrics.length}\n`;
    report += `**Fern Path:** ${FERN_PATH}\n\n`;

    // Calculate averages
    const avgStartupTime = metrics.reduce((sum, m) => sum + m.totalStartupTime, 0) / metrics.length;
    const minStartupTime = Math.min(...metrics.map((m) => m.totalStartupTime));
    const maxStartupTime = Math.max(...metrics.map((m) => m.totalStartupTime));

    report += `## Summary\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Average Startup Time | ${(avgStartupTime / 1000).toFixed(2)}s |\n`;

    if (metrics.length > 1) {
        report += `| Min Startup Time | ${(minStartupTime / 1000).toFixed(2)}s |\n`;
        report += `| Max Startup Time | ${(maxStartupTime / 1000).toFixed(2)}s |\n`;
    }

    report += `\n## Service Startup Times\n\n`;
    report += `| Service | Average | Status |\n`;
    report += `|---------|---------|--------|\n`;

    const serviceNames = [...new Set(metrics.flatMap((m) => m.services.map((s) => s.name)))];
    for (const serviceName of serviceNames) {
        const serviceTimes = metrics
            .map((m) => m.services.find((s) => s.name === serviceName))
            .filter((s) => s !== undefined);

        const successfulTimes = serviceTimes.filter((s) => s!.status === "ready");

        if (successfulTimes.length > 0) {
            const avgTime = successfulTimes.reduce((sum, s) => sum + s!.duration, 0) / successfulTimes.length;
            const successRate = ((successfulTimes.length / serviceTimes.length) * 100).toFixed(0);
            report += `| ${serviceName} | ${(avgTime / 1000).toFixed(2)}s | ${successRate}% success |\n`;
        } else {
            report += `| ${serviceName} | N/A | 0% success |\n`;
        }
    }

    // Add stats if available
    if (COLLECT_STATS && metrics[0].dockerStats.length > 0) {
        report += `\n## Resource Usage\n\n`;

        const allStats = metrics.flatMap((m) => m.dockerStats);
        const avgCpu = allStats.reduce((sum, s) => sum + s.cpuPercent, 0) / allStats.length;
        const maxCpu = Math.max(...allStats.map((s) => s.cpuPercent));
        const avgMem = allStats.reduce((sum, s) => sum + s.memoryUsageMB, 0) / allStats.length;
        const maxMem = Math.max(...allStats.map((s) => s.memoryUsageMB));

        report += `| Metric | Average | Maximum |\n`;
        report += `|--------|---------|--------|\n`;
        report += `| CPU % | ${avgCpu.toFixed(2)}% | ${maxCpu.toFixed(2)}% |\n`;
        report += `| Memory | ${avgMem.toFixed(2)} MB | ${maxMem.toFixed(2)} MB |\n`;
    }

    return report;
}

async function main() {
    console.log(chalk.bold.blue("🚀 Fern Self-Hosted Performance Test\n"));
    console.log(chalk.bold("Configuration:"));
    console.log(chalk.dim(`  Fern Path: ${FERN_PATH}`));
    if (MOUNT_FOLDERS.length > 0) {
        console.log(chalk.dim(`  Mount Folders:`));
        for (const folder of MOUNT_FOLDERS) {
            console.log(chalk.dim(`    - ${folder} -> /${path.basename(folder)}`));
        }
    }
    console.log(chalk.dim(`  Iterations: ${ITERATIONS}`));
    console.log(chalk.dim(`  Output Directory: ${OUTPUT_DIR}`));
    console.log(chalk.dim(`  Collect Stats: ${COLLECT_STATS}`));
    console.log(chalk.dim(`  Show Logs: ${SHOW_LOGS}`));
    if (IMAGE_VERSION) {
        console.log(chalk.dim(`  Docker Username: ${options.dockerUsername}`));
    }

    // Determine which image to use
    let imageName = "fern-self-hosted:latest";
    if (IMAGE_VERSION) {
        console.log(chalk.dim(`  Image Version: ${IMAGE_VERSION}`));

        // Get Docker credentials
        const dockerUsername = options.dockerUsername;
        const dockerHubPassword = options.dockerhubPassword || process.env.DOCKERHUB_PASSWORD;

        if (!dockerHubPassword) {
            console.error(chalk.red(`\n❌ DockerHub password is required to pull images from DockerHub. `));
            console.error(
                chalk.red(`   Set DOCKERHUB_PASSWORD environment variable or use --dockerhub-password option.`)
            );
            process.exit(1);
        }

        try {
            // Authenticate with DockerHub and pull the image
            await authenticateDockerHub(dockerUsername, dockerHubPassword);
            imageName = await pullDockerImage(IMAGE_VERSION);
        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to prepare Docker image: ${error}`));
            process.exit(1);
        }
    } else {
        console.log(chalk.dim(`  Image: Using local ${imageName}`));
    }

    // Verify fern path exists
    if (!fs.existsSync(FERN_PATH)) {
        console.error(chalk.red(`\n❌ Fern path does not exist: ${FERN_PATH}`));
        process.exit(1);
    }

    // Verify mount folders exist if specified
    for (const folder of MOUNT_FOLDERS) {
        if (!fs.existsSync(folder)) {
            console.error(chalk.red(`\n❌ Mount folder does not exist: ${folder}`));
            process.exit(1);
        }
    }

    const metrics: PerformanceMetrics[] = [];

    for (let i = 1; i <= ITERATIONS; i++) {
        console.log(chalk.bold.cyan(`\n${"=".repeat(60)}`));
        console.log(chalk.bold.cyan(`📊 Iteration ${i}/${ITERATIONS}`));
        console.log(chalk.bold.cyan(`${"=".repeat(60)}`));

        try {
            // Clean up any existing container
            await removeContainer();

            // Start container
            await startContainer(imageName);

            // Measure startup
            const metric = await measureStartup();
            metrics.push(metric);

            console.log(
                chalk.bold.green(`\n✅ Iteration ${i} complete: ${(metric.totalStartupTime / 1000).toFixed(2)}s total`)
            );

            // Save individual iteration report
            if (ITERATIONS > 1) {
                const report = generateReport([metric], i);
                const reportPath = path.join(OUTPUT_DIR, `iteration-${i}.md`);
                fs.writeFileSync(reportPath, report);
                console.log(chalk.dim(`   Report saved to: ${reportPath}`));
            }

            // Clean up
            console.log(chalk.cyan("\n🧹 Cleaning up..."));
            await removeContainer();
            console.log(chalk.green("  ✓ Container removed"));

            // Wait between iterations
            if (i < ITERATIONS) {
                console.log(chalk.dim("\n⏸️  Waiting 5 seconds before next iteration..."));
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error(chalk.red(`\n❌ Iteration ${i} failed: ${error}`));
            await removeContainer();
        }
    }

    if (metrics.length === 0) {
        console.error(chalk.red("\n❌ No successful iterations completed"));
        process.exit(1);
    }

    // Generate summary report
    console.log(chalk.yellow("\n" + "=".repeat(60)));
    console.log(chalk.yellow("📝 Generating summary report..."));
    console.log(chalk.yellow("=".repeat(60)));

    const summaryReport = generateReport(metrics);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(OUTPUT_DIR, `performance-report-${timestamp}.md`);
    fs.writeFileSync(reportPath, summaryReport);

    console.log(chalk.green(`\n✅ Report saved to: ${reportPath}`));

    // Save raw metrics as JSON
    const metricsPath = path.join(OUTPUT_DIR, `performance-metrics-${timestamp}.json`);
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
    console.log(chalk.blue(`📊 Raw metrics saved to: ${metricsPath}`));

    // Print summary
    console.log(chalk.bold.magenta("\n" + "=".repeat(60)));
    console.log(chalk.bold.magenta("📈 Performance Summary"));
    console.log(chalk.bold.magenta("=".repeat(60)));

    const avgStartupTime = metrics.reduce((sum, m) => sum + m.totalStartupTime, 0) / metrics.length;
    console.log(chalk.white(`\n  Total Startup Time: ${chalk.bold((avgStartupTime / 1000).toFixed(2) + "s")}`));

    console.log(chalk.white("\n  Service Breakdown:"));
    for (const serviceName of [...new Set(metrics.flatMap((m) => m.services.map((s) => s.name)))]) {
        const times = metrics
            .map((m) => m.services.find((s) => s.name === serviceName))
            .filter((s) => s?.status === "ready")
            .map((s) => s!.duration);

        if (times.length > 0) {
            const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
            const timeStr = (avgTime / 1000).toFixed(2) + "s";

            // Color code based on service name
            let color = chalk.white;
            if (serviceName.toLowerCase().includes("postgres")) {
                color = chalk.blue;
            } else if (serviceName.toLowerCase().includes("minio")) {
                color = chalk.yellow;
            } else if (serviceName.toLowerCase().includes("meili")) {
                color = chalk.magenta;
            } else if (serviceName.toLowerCase().includes("fdr")) {
                color = chalk.cyan;
            } else if (serviceName.toLowerCase().includes("docs")) {
                color = chalk.green;
            }

            console.log(`    ${color("●")} ${serviceName.padEnd(20)} ${chalk.bold(timeStr)}`);
        }
    }

    console.log(chalk.bold.green("\n✨ Performance test complete!\n"));
}

// Run the script
main().catch((error) => {
    console.error(chalk.red.bold(`\n❌ Fatal error: ${error}`));
    process.exit(1);
});
