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

function executeHealthCheck(scriptName) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(SCRIPTS_DIR, scriptName);

        exec(`bash ${scriptPath}`, { timeout: 30000 }, (error, stdout, stderr) => {
            const output = stdout + stderr;

            if (error) {
                resolve({
                    healthy: false,
                    exitCode: error.code,
                    output: output.trim()
                });
            } else {
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
});

server.listen(PORT, "0.0.0.0", () => {});

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
