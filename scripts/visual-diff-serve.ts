#!/usr/bin/env tsx
import * as fs from "fs";
import * as http from "http";
import * as path from "path";

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || "application/octet-stream";
}

function serveFile(res: http.ServerResponse, filePath: string): void {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found");
            return;
        }
        res.writeHead(200, { "Content-Type": getMimeType(filePath) });
        res.end(data);
    });
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    let outputDir = "./visual-diff-output";
    let port = 3333;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        if ((arg === "--dir" || arg === "-d") && nextArg) {
            outputDir = nextArg;
            i++;
        } else if ((arg === "--port" || arg === "-p") && nextArg) {
            port = parseInt(nextArg, 10);
            i++;
        } else if (arg === "--help" || arg === "-h") {
            console.log(`
Visual Diff Report Server

Usage:
  pnpm visual-diff:serve [options]

Options:
  --dir, -d   Directory containing the visual diff output (default: ./visual-diff-output)
  --port, -p  Port to serve on (default: 3333)
  --help, -h  Show this help message

Examples:
  pnpm visual-diff:serve
  pnpm visual-diff:serve --dir ./my-output --port 8080
`);
            process.exit(0);
        }
    }

    const absoluteDir = path.resolve(outputDir);
    const reportPath = path.join(absoluteDir, "report.html");

    if (!fs.existsSync(reportPath)) {
        console.error(`Error: report.html not found in ${absoluteDir}`);
        console.error("Run 'pnpm visual-diff' first to generate the report.");
        process.exit(1);
    }

    const server = http.createServer((req, res) => {
        let urlPath = req.url || "/";

        if (urlPath === "/") {
            urlPath = "/report.html";
        }

        const filePath = path.join(absoluteDir, urlPath);

        if (!filePath.startsWith(absoluteDir)) {
            res.writeHead(403, { "Content-Type": "text/plain" });
            res.end("403 Forbidden");
            return;
        }

        serveFile(res, filePath);
    });

    server.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`Visual Diff Report Server`);
        console.log(`=`.repeat(60));
        console.log(`Serving: ${absoluteDir}`);
        console.log(`URL: ${url}`);
        console.log(`=`.repeat(60));
        console.log(`\nPress Ctrl+C to stop the server\n`);

        const { exec } = require("child_process");
        const openCommand =
            process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${openCommand} ${url}`);
    });
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
