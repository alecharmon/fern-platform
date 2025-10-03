import next from "next";

import express from "express";
import { createServer } from "http";
import { AddressInfo } from "net";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Function to find an available port
const findAvailablePort = (startPort: number): Promise<number> => {
    return new Promise((resolve) => {
        const server = createServer();

        server.listen(startPort, () => {
            const { port } = server.address() as AddressInfo;
            server.close(() => {
                resolve(port);
            });
        });

        server.on("error", () => {
            // Port is in use, try the next one
            resolve(findAvailablePort(startPort + 1));
        });
    });
};

app.prepare()
    .then(async () => {
        const app = express();
        const port = await findAvailablePort(9999);
        const baseUrl = `http://localhost:${port}`;

        app.get("/api/metadata", (_, res) => {
            res.json({
                domain: "localhost",
                basePath: "/docs",
                url: `${baseUrl}/docs`,
                org: "Local Preview",
                isPreview: true
            });
        });

        app.all("*", (req, res) => {
            const parsedUrl = parse(req.url, true);
            void handle(req, res, parsedUrl);
        });

        createServer(app).listen(port, (err?: any) => {
            if (err) throw err;
            console.log(`> Ready on ${baseUrl}`);
        });
    })
    .catch((err: unknown) => {
        console.error("Error starting server:", err);
        process.exit(1);
    });
