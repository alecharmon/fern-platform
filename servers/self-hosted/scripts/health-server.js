#!/usr/bin/env node
/**
 * Health Check HTTP Server
 *
 * Exposes liveness and readiness probe endpoints for Kubernetes/Helm deployments.
 * - /liveness: Checks if all critical service processes are still running (PID check)
 * - /readiness: Checks if all services are healthy and ready to serve traffic
 */

const http = require("http");
const { exec } = require("child_process");
const path = require("path");

const PORT = process.env.HEALTH_CHECK_PORT || 8081;
const SCRIPTS_DIR = path.dirname(__filename);
const SCRIPT_TIMEOUT_MS = 10000;

function log(message) {
    const timestamp = new Date().toISOString();
    // biome-ignore lint/suspicious/noConsole: This is a logging function for the health server
    console.log(`[${timestamp}] [health-server] ${message}`);
}

function executeHealthCheck(scriptName) {
    return new Promise((resolve) => {
        const scriptPath = path.join(SCRIPTS_DIR, scriptName);
        const startTime = Date.now();

        exec(`bash ${scriptPath}`, { timeout: SCRIPT_TIMEOUT_MS }, (error, stdout, stderr) => {
            const duration = Date.now() - startTime;
            const output = stdout + stderr;

            if (error) {
                if (error.killed) {
                    log(`${scriptName} timed out after ${duration}ms`);
                    resolve({
                        healthy: false,
                        exitCode: -1,
                        output: `Health check timed out after ${SCRIPT_TIMEOUT_MS}ms. Services may be slow to respond.`
                    });
                } else {
                    log(`${scriptName} failed (exit code ${error.code}) in ${duration}ms`);
                    resolve({
                        healthy: false,
                        exitCode: error.code || 1,
                        output: output.trim()
                    });
                }
            } else {
                log(`${scriptName} passed in ${duration}ms`);
                resolve({
                    healthy: true,
                    exitCode: 0,
                    output: output.trim()
                });
            }
        });
    });
}

const server = http.createServer(async (req, res) => {
    const url = req.url;

    try {
        if (url === "/liveness") {
            const result = await executeHealthCheck("liveness.sh");

            res.statusCode = result.healthy ? 200 : 503;
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({
                    status: result.healthy ? "healthy" : "unhealthy",
                    check: "liveness",
                    exitCode: result.exitCode,
                    message: result.output,
                    timestamp: new Date().toISOString()
                })
            );
        } else if (url === "/readiness") {
            const result = await executeHealthCheck("readiness.sh");

            res.statusCode = result.healthy ? 200 : 503;
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({
                    status: result.healthy ? "ready" : "not_ready",
                    check: "readiness",
                    exitCode: result.exitCode,
                    message: result.output,
                    timestamp: new Date().toISOString()
                })
            );
        } else if (url === "/health") {
            const result = await executeHealthCheck("readiness.sh");

            res.statusCode = result.healthy ? 200 : 503;
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({
                    status: result.healthy ? "ok" : "error",
                    check: "health",
                    exitCode: result.exitCode,
                    message: result.output,
                    timestamp: new Date().toISOString()
                })
            );
        } else {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({
                    error: "Not Found",
                    message: "Available endpoints: /liveness, /readiness, /health",
                    timestamp: new Date().toISOString()
                })
            );
        }
    } catch (error) {
        log(`Error handling request ${url}: ${error.message}`);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
            JSON.stringify({
                status: "error",
                error: "Internal Server Error",
                message: error.message,
                timestamp: new Date().toISOString()
            })
        );
    }
});

server.listen(PORT, "0.0.0.0", () => {
    log(`Health check server started on port ${PORT}`);
    log(`Endpoints: /liveness, /readiness, /health`);
});

process.on("SIGTERM", () => {
    server.close(() => {
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    server.close(() => {
        process.exit(0);
    });
});
