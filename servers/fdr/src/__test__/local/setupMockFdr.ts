import { FdrClient } from "@fern-api/fdr-sdk";
import { OpenAPIHandler } from "@orpc/openapi/node";
import { onError } from "@orpc/server";
import { PrismaClient } from "@prisma/client";
import { execa } from "execa";
import express from "express";
import type http from "http";
import { register } from "../../api";
import type { FdrApplication, FdrConfig } from "../../app";
import { getApiLatestService } from "../../controllers/api/getApiLatestService";
import { getReadApiService } from "../../controllers/api/getApiReadService";
import { getRegisterApiService } from "../../controllers/api/getRegisterApiService";
import { createDashboardRouter } from "../../controllers/dashboard/getDashboardRouter";
import { getDocsReadService } from "../../controllers/docs/v1/getDocsReadService";
import { getDocsWriteService } from "../../controllers/docs/v1/getDocsWriteService";
import { getDocsReadV2Service } from "../../controllers/docs/v2/getDocsReadV2Service";
import { getDocsWriteV2Service } from "../../controllers/docs/v2/getDocsWriteV2Service";
import { createLibraryDocsRouter } from "../../controllers/docs/v2/getLibraryDocsRouter";
import { createGetOrganizationForUrlRouter } from "../../controllers/docs/v2/getOrganizationForUrlRouter";
import { createDocsCacheRouter } from "../../controllers/docs-cache/docsCacheRouter";
import { createCliRouter } from "../../controllers/generators/cliRouter";
import { createGeneratorVersionsRouter } from "../../controllers/generators/generatorVersionsRouter";
import { getGeneratorsRootController } from "../../controllers/generators/getGeneratorsRootController";
import { createGitRouter } from "../../controllers/git/gitRouter";
import { createPdfExportRouter } from "../../controllers/pdf-export";
import { createComputeSemanticVersionRouter } from "../../controllers/sdk/computeSemanticVersionRouter";
import { createSnippetsForSdkRouter } from "../../controllers/snippets/createSnippetsForSdkRouter";
import { createTemplatesRouter } from "../../controllers/snippets/createTemplatesRouter";
import { getSnippetsService } from "../../controllers/snippets/getSnippetsService";
import { getTokensService } from "../../controllers/tokens/getTokensService";
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
    const orpcHandler = new OpenAPIHandler(
        { ...orgForUrlRouter, ...dashboardRouter, ...pdfExportRouter },
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

    register(app, {
        docs: {
            v1: {
                read: { _root: getDocsReadService(fdrApplication) },
                write: { _root: getDocsWriteService(fdrApplication) }
            },
            v2: {
                read: { _root: getDocsReadV2Service(fdrApplication) },
                write: { _root: getDocsWriteV2Service(fdrApplication) }
            }
        },
        api: {
            v1: {
                read: { _root: getReadApiService(fdrApplication) },
                register: { _root: getRegisterApiService(fdrApplication) }
            },
            latest: { _root: getApiLatestService(fdrApplication) }
        },
        snippets: getSnippetsService(fdrApplication),
        generators: {
            _root: getGeneratorsRootController(fdrApplication)
        },
        tokens: getTokensService(fdrApplication)
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
