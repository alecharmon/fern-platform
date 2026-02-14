#!/usr/bin/env node

// Returns non-default version URL slug prefixes from the FDR API.
// The first version in the array is the default; all others are output (one per line).
// If the site is unversioned or the API is unreachable, outputs nothing (exit 0).

const http = require("http");

const domain = process.env.NEXT_PUBLIC_DOCS_DOMAIN_URL || "localhost";
const fdrPort = process.env.FDR_PORT || "8080";

const body = JSON.stringify({ url: domain });

const req = http.request(
    {
        hostname: "127.0.0.1",
        port: parseInt(fdrPort, 10),
        path: "/v2/registry/docs/load-with-url",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
        },
        timeout: 15000
    },
    (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
            try {
                const data = JSON.parse(Buffer.concat(chunks).toString());
                const nav = data?.definition?.config?.navigation;
                if (!nav || !nav.versions || nav.versions.length <= 1) {
                    process.exit(0);
                }
                // First version (idx 0) is default — output the rest
                for (let i = 1; i < nav.versions.length; i++) {
                    const slug = nav.versions[i].urlSlug;
                    if (slug) {
                        process.stdout.write(slug + "\n");
                    }
                }
            } catch {
                // Parse error — treat as unversioned
            }
        });
    }
);

req.on("error", () => {
    // FDR unreachable — treat as unversioned, warm everything
});

req.on("timeout", () => {
    req.destroy();
});

req.write(body);
req.end();
