import { FdrClient } from "@fern-api/fdr-sdk";
import { OpenAPIHandler } from "@orpc/openapi/node";
import { onError } from "@orpc/server";
import { PrismaClient } from "@prisma/client";
import { execa } from "execa";
import express from "express";
import type http from "http";
import type { FdrApplication, FdrConfig } from "../../app";
import { createReadApiRouter } from "../../controllers/api/getApiReadRouter";
import { createRegisterApiRouter } from "../../controllers/api/getRegisterApiRouter";
import { createGetApiLatestRouter } from "../../controllers/api/latest/getApiLatestRouter";
import { createDashboardRouter } from "../../controllers/dashboard/getDashboardRouter";
import { createDocsV1ReadRouter } from "../../controllers/docs/v1/getDocsReadService";
import { createDocsV1WriteRouter } from "../../controllers/docs/v1/getDocsWriteService";
import { createDocsV2ReadRouter } from "../../controllers/docs/v2/getDocsReadV2Service";
import { createDocsV2WriteRouter } from "../../controllers/docs/v2/getDocsWriteV2Service";
import { createLibraryDocsRouter } from "../../controllers/docs/v2/getLibraryDocsRouter";
import { createGetOrganizationForUrlRouter } from "../../controllers/docs/v2/getOrganizationForUrlRouter";
import { createDocsCacheRouter } from "../../controllers/docs-cache/docsCacheRouter";
import { createCliRouter } from "../../controllers/generators/cliRouter";
import { createGeneratorsRootRouter } from "../../controllers/generators/generatorsRootRouter";
import { createGeneratorVersionsRouter } from "../../controllers/generators/generatorVersionsRouter";
import { createGitRouter } from "../../controllers/git/gitRouter";
import { createPdfExportRouter } from "../../controllers/pdf-export";
import { createComputeSemanticVersionRouter } from "../../controllers/sdk/computeSemanticVersionRouter";
import { createSnippetsForSdkRouter } from "../../controllers/snippets/createSnippetsForSdkRouter";
import { createTemplatesRouter } from "../../controllers/snippets/createTemplatesRouter";
import { createSnippetsRouter } from "../../controllers/snippets/snippetsRouter";
import { createTokensRouter } from "../../controllers/tokens/createTokensRouter";
import { createMockFdrApplication } from "../mock";

let teardown = false;

declare module "vitest" {
    export interface ProvidedContext {
        url: string;
    }
}

export async function setup({ provide }: { provide: (key: string, value: any) => void }) {
    await execa("docker-compose", ["-f", "docker-compose.test.yml", "up", "-d"], {
        stdio: "inherit"
    });
    await sleep(3000);
    await execa("pnpm", ["prisma", "migrate", "deploy"], {
        stdio: "inherit"
    });
    const instance = await runMockFdr(9999);
    provide("url", `http://localhost:${instance.port}/`);
    return async () => {
        if (teardown) {
            throw new Error("teardown called twice");
        }
        teardown = true;
        await execa("docker-compose", ["-f", "docker-compose.test.yml", "down"], {
            stdio: "inherit"
        });
        return new Promise<void>((resolve) => {
            instance.server?.close(() => resolve());
        });
    };
}

export const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
    transactionOptions: {
        timeout: 15000,
        maxWait: 15000
    }
});

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

declare namespace MockFdr {
    interface Instance {
        authedClient: FdrClient;
        unauthedClient: FdrClient;
        prisma: PrismaClient;
        app: FdrApplication;
        server: http.Server | undefined;
        port: number;
    }
}

async function runMockFdr(port: number): Promise<MockFdr.Instance> {
    const unauthedClient = new FdrClient({
        environment: `http://localhost:${port}/`
    });
    const authedClient = new FdrClient({
        environment: `http://localhost:${port}/`,
        token: "dummy"
    });
    const overrides: Partial<FdrConfig> = {
        redisEnabled: true,
        // Enable CLI permission check for permission-denied-org
        cliPermissionCheckOrgIds: new Set(["permission-denied-org"])
    };
    const fdrApplication = createMockFdrApplication({
        orgIds: ["acme", "octoai", "dashboard-org", "permission-denied-org"],
        configOverrides: overrides,
        // Deny CLI permission for permission-denied-org to test permission denial
        denyCliPermissionForOrgs: new Set(["permission-denied-org"])
    });
    const app = express();
    await fdrApplication.initialize();

    const orgForUrlRouter = createGetOrganizationForUrlRouter(fdrApplication);
    const dashboardRouter = createDashboardRouter(fdrApplication);
    const pdfExportRouter = createPdfExportRouter(fdrApplication);
    const apiLatestRouter = createGetApiLatestRouter(fdrApplication);
    const registerApiRouter = createRegisterApiRouter(fdrApplication);
    const readApiRouter = createReadApiRouter(fdrApplication);
    const orpcHandler = new OpenAPIHandler(
        {
            ...orgForUrlRouter,
            ...dashboardRouter,
            ...pdfExportRouter,
            ...apiLatestRouter,
            ...registerApiRouter,
            ...readApiRouter
        },
        {
            interceptors: [
                onError((error) => {
                    console.error("oRPC error:", error);
                })
            ]
        }
    );

    const libraryDocsRouter = createLibraryDocsRouter(fdrApplication);
    const libraryDocsHandler = new OpenAPIHandler(libraryDocsRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC libraryDocs error:", error);
            })
        ]
    });

    app.use("/v2/registry/docs", async (req, res, next) => {
        const { matched: orgMatched } = await orpcHandler.handle(req, res, {
            prefix: "/v2/registry/docs",
            context: { headers: req.headers }
        });
        if (orgMatched) {
            return;
        }
        const { matched: libDocsMatched } = await libraryDocsHandler.handle(req, res, {
            prefix: "/v2/registry/docs",
            context: { headers: req.headers }
        });
        if (libDocsMatched) {
            return;
        }
        next();
    });

    app.use("/dashboard", async (req, res, next) => {
        const { matched } = await orpcHandler.handle(req, res, {
            prefix: "/dashboard",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const cliRouter = createCliRouter(fdrApplication);
    const cliHandler = new OpenAPIHandler(cliRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC CLI error:", error);
            })
        ]
    });

    app.use("/generators/cli", async (req, res, next) => {
        const { matched } = await cliHandler.handle(req, res, {
            prefix: "/generators/cli",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const templatesRouter = createTemplatesRouter(fdrApplication);
    const templatesHandler = new OpenAPIHandler(templatesRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC templates error:", error);
            })
        ]
    });

    app.use("/snippet-template", async (req, res, next) => {
        const { matched } = await templatesHandler.handle(req, res, {
            prefix: "/snippet-template",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const generatorsRootRouter = createGeneratorsRootRouter(fdrApplication);
    const generatorsRootHandler = new OpenAPIHandler(generatorsRootRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC generators error:", error);
            })
        ]
    });

    app.use("/generators", async (req, res, next) => {
        const { matched } = await generatorsRootHandler.handle(req, res, {
            prefix: "/generators",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const generatorVersionsRouter = createGeneratorVersionsRouter(fdrApplication);
    const generatorVersionsHandler = new OpenAPIHandler(generatorVersionsRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC generatorVersions error:", error);
            })
        ]
    });

    app.use("/generators/versions", async (req, res, next) => {
        const { matched } = await generatorVersionsHandler.handle(req, res, {
            prefix: "/generators/versions",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const sdkVersionsRouter = createComputeSemanticVersionRouter(fdrApplication);
    const sdkVersionsHandler = new OpenAPIHandler(sdkVersionsRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC computeSemanticVersion error:", error);
            })
        ]
    });

    app.use("/sdks", async (req, res, next) => {
        const { matched } = await sdkVersionsHandler.handle(req, res, {
            prefix: "/sdks",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    app.use("/pdf-export", async (req, res, next) => {
        const { matched } = await orpcHandler.handle(req, res, {
            prefix: "/pdf-export",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    app.use("/registry/api/latest", async (req, res, next) => {
        const { matched } = await orpcHandler.handle(req, res, {
            prefix: "/registry/api/latest",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    app.use("/registry/api", async (req, res, next) => {
        const { matched } = await orpcHandler.handle(req, res, {
            prefix: "/registry/api",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const docsCacheRouter = createDocsCacheRouter(fdrApplication);
    const docsCacheHandler = new OpenAPIHandler(docsCacheRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC docsCache error:", error);
            })
        ]
    });

    app.use("/docs-cache", async (req, res, next) => {
        const { matched } = await docsCacheHandler.handle(req, res, {
            prefix: "/docs-cache",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const gitRouter = createGitRouter(fdrApplication);
    const gitHandler = new OpenAPIHandler(gitRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC git error:", error);
            })
        ]
    });

    app.use("/generators/github", async (req, res, next) => {
        const { matched } = await gitHandler.handle(req, res, {
            prefix: "/generators/github",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const snippetsFactoryRouter = createSnippetsForSdkRouter(fdrApplication);
    const snippetsFactoryHandler = new OpenAPIHandler(snippetsFactoryRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC createSnippetsForSdk error:", error);
            })
        ]
    });

    app.use("/snippets", async (req, res, next) => {
        const { matched } = await snippetsFactoryHandler.handle(req, res, {
            prefix: "/snippets",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const tokensRouter = createTokensRouter(fdrApplication);
    const tokensHandler = new OpenAPIHandler(tokensRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC tokens error:", error);
            })
        ]
    });

    app.use("/tokens", async (req, res, next) => {
        const { matched } = await tokensHandler.handle(req, res, {
            prefix: "/tokens",
            context: { headers: req.headers }
        });
        if (matched) {
            return;
        }
        next();
    });

    const snippetsRouter = createSnippetsRouter(fdrApplication);
    const snippetsHandler = new OpenAPIHandler(snippetsRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC snippets error:", error);
            })
        ]
    });

    app.use("/snippets", async (req, res, next) => {
        const { matched } = await snippetsHandler.handle(req, res, {
            prefix: "/snippets",
            context: { headers: req.headers, query: req.query as Record<string, string | undefined> }
        });
        if (matched) {
            return;
        }
        next();
    });

    const docsV1ReadRouter = createDocsV1ReadRouter(fdrApplication);
    const docsV1WriteRouter = createDocsV1WriteRouter(fdrApplication);
    const docsV2ReadRouter = createDocsV2ReadRouter(fdrApplication);
    const docsV2WriteRouter = createDocsV2WriteRouter(fdrApplication);

    const docsV2ReadHandler = new OpenAPIHandler(
        { ...docsV2ReadRouter },
        {
            interceptors: [
                onError((error) => {
                    console.error("oRPC docsV2Read error:", error);
                })
            ]
        }
    );

    const docsV2WriteHandler = new OpenAPIHandler(
        { ...docsV2WriteRouter },
        {
            interceptors: [
                onError((error) => {
                    console.error("oRPC docsV2Write error:", error);
                })
            ]
        }
    );

    const docsV1ReadHandler = new OpenAPIHandler(
        { ...docsV1ReadRouter },
        {
            interceptors: [
                onError((error) => {
                    console.error("oRPC docsV1Read error:", error);
                })
            ]
        }
    );

    const docsV1WriteHandler = new OpenAPIHandler(
        { ...docsV1WriteRouter },
        {
            interceptors: [
                onError((error) => {
                    console.error("oRPC docsV1Write error:", error);
                })
            ]
        }
    );

    app.use("/v2/registry/docs", async (req, res, next) => {
        const { matched: orgMatched } = await orpcHandler.handle(req, res, {
            prefix: "/v2/registry/docs",
            context: { headers: req.headers }
        });
        if (orgMatched) {
            return;
        }
        const { matched: libDocsMatched } = await libraryDocsHandler.handle(req, res, {
            prefix: "/v2/registry/docs",
            context: { headers: req.headers }
        });
        if (libDocsMatched) {
            return;
        }
        const { matched: v2ReadMatched } = await docsV2ReadHandler.handle(req, res, {
            prefix: "/v2/registry/docs",
            context: { headers: req.headers }
        });
        if (v2ReadMatched) {
            return;
        }
        const { matched: v2WriteMatched } = await docsV2WriteHandler.handle(req, res, {
            prefix: "/v2/registry/docs",
            context: { headers: req.headers }
        });
        if (v2WriteMatched) {
            return;
        }
        next();
    });

    app.use("/registry/docs", async (req, res, next) => {
        const { matched: v1ReadMatched } = await docsV1ReadHandler.handle(req, res, {
            prefix: "/registry/docs",
            context: { headers: req.headers }
        });
        if (v1ReadMatched) {
            return;
        }
        const { matched: v1WriteMatched } = await docsV1WriteHandler.handle(req, res, {
            prefix: "/registry/docs",
            context: { headers: req.headers }
        });
        if (v1WriteMatched) {
            return;
        }
        next();
    });

    const server = app.listen(port);
    console.log(`Mock FDR server running on http://localhost:${port}/`);
    return {
        authedClient,
        unauthedClient,
        prisma,
        app: fdrApplication,
        server,
        port
    };
}
