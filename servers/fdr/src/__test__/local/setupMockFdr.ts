import { FdrClient } from "@fern-api/fdr-sdk";
import { OpenAPIHandler } from "@orpc/openapi/fastify";
import { onError } from "@orpc/server";
import { PrismaClient } from "@prisma/client";
import { execa } from "execa";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
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
import { createSlugsRouter } from "../../controllers/slugs/slugsRouter";
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
    await execa("docker", ["compose", "-f", "docker-compose.test.yml", "up", "-d"], {
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
        await execa("docker", ["compose", "-f", "docker-compose.test.yml", "down"], {
            stdio: "inherit"
        });
        await instance.fastifyApp?.close();
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
        fastifyApp: FastifyInstance | undefined;
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
        cliPermissionCheckOrgIds: new Set(["permission-denied-org"])
    };
    const fdrApplication = createMockFdrApplication({
        orgIds: ["acme", "octoai", "dashboard-org", "permission-denied-org"],
        configOverrides: overrides,
        denyCliPermissionForOrgs: new Set(["permission-denied-org"])
    });
    const fastifyApp = Fastify({ bodyLimit: 100 * 1024 * 1024 });

    fastifyApp.addContentTypeParser("*", (_request, _payload, done) => {
        done(null, undefined);
    });

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

    const headersContext = (req: FastifyRequest) => ({ headers: req.headers });

    function mountOrpc(
        prefix: `/${string}`,
        handlers: Array<{
            handler: OpenAPIHandler<Record<string, unknown>>;
            getContext: (req: FastifyRequest) => Record<string, unknown>;
        }>
    ) {
        const routeHandler = async (req: FastifyRequest, reply: FastifyReply) => {
            for (const { handler, getContext } of handlers) {
                const { matched } = await handler.handle(req, reply, {
                    prefix,
                    context: getContext(req)
                });
                if (matched) {
                    return;
                }
            }
            reply.callNotFound();
        };
        fastifyApp.all(prefix as `/${string}`, routeHandler);
        fastifyApp.all(`${prefix}/*` as `/${string}`, routeHandler);
    }

    const cliRouter = createCliRouter(fdrApplication);
    const cliHandler = new OpenAPIHandler(cliRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC CLI error:", error);
            })
        ]
    });

    mountOrpc("/generators/cli", [{ handler: cliHandler, getContext: headersContext }]);

    const templatesRouter = createTemplatesRouter(fdrApplication);
    const templatesHandler = new OpenAPIHandler(templatesRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC templates error:", error);
            })
        ]
    });

    mountOrpc("/snippet-template", [{ handler: templatesHandler, getContext: headersContext }]);

    const generatorsRootRouter = createGeneratorsRootRouter(fdrApplication);
    const generatorsRootHandler = new OpenAPIHandler(generatorsRootRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC generators error:", error);
            })
        ]
    });

    const generatorVersionsRouter = createGeneratorVersionsRouter(fdrApplication);
    const generatorVersionsHandler = new OpenAPIHandler(generatorVersionsRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC generatorVersions error:", error);
            })
        ]
    });

    mountOrpc("/generators/versions", [{ handler: generatorVersionsHandler, getContext: headersContext }]);

    const sdkVersionsRouter = createComputeSemanticVersionRouter(fdrApplication);
    const sdkVersionsHandler = new OpenAPIHandler(sdkVersionsRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC computeSemanticVersion error:", error);
            })
        ]
    });

    mountOrpc("/sdks", [{ handler: sdkVersionsHandler, getContext: headersContext }]);

    mountOrpc("/pdf-export", [{ handler: orpcHandler, getContext: headersContext }]);

    mountOrpc("/registry/api/latest", [{ handler: orpcHandler, getContext: headersContext }]);

    mountOrpc("/registry/api", [{ handler: orpcHandler, getContext: headersContext }]);

    const docsCacheRouter = createDocsCacheRouter(fdrApplication);
    const docsCacheHandler = new OpenAPIHandler(docsCacheRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC docsCache error:", error);
            })
        ]
    });

    mountOrpc("/docs-cache", [{ handler: docsCacheHandler, getContext: headersContext }]);

    const gitRouter = createGitRouter(fdrApplication);
    const gitHandler = new OpenAPIHandler(gitRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC git error:", error);
            })
        ]
    });

    mountOrpc("/generators/github", [{ handler: gitHandler, getContext: headersContext }]);

    const snippetsFactoryRouter = createSnippetsForSdkRouter(fdrApplication);
    const snippetsFactoryHandler = new OpenAPIHandler(snippetsFactoryRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC createSnippetsForSdk error:", error);
            })
        ]
    });

    const tokensRouter = createTokensRouter(fdrApplication);
    const tokensHandler = new OpenAPIHandler(tokensRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC tokens error:", error);
            })
        ]
    });

    mountOrpc("/tokens", [{ handler: tokensHandler, getContext: headersContext }]);

    const slugsRouter = createSlugsRouter(fdrApplication);
    const slugsHandler = new OpenAPIHandler(slugsRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC slugs error:", error);
            })
        ]
    });

    mountOrpc("/slugs", [{ handler: slugsHandler, getContext: headersContext }]);

    const snippetsRouter = createSnippetsRouter(fdrApplication);
    const snippetsHandler = new OpenAPIHandler(snippetsRouter, {
        interceptors: [
            onError((error) => {
                console.error("oRPC snippets error:", error);
            })
        ]
    });

    mountOrpc("/snippets", [
        { handler: snippetsFactoryHandler, getContext: headersContext },
        {
            handler: snippetsHandler,
            getContext: (req: FastifyRequest) => ({
                headers: req.headers,
                query: req.query as Record<string, string | undefined>
            })
        }
    ]);

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

    mountOrpc("/v2/registry/docs", [
        { handler: orpcHandler, getContext: headersContext },
        { handler: libraryDocsHandler, getContext: headersContext },
        { handler: docsV2ReadHandler, getContext: headersContext },
        { handler: docsV2WriteHandler, getContext: headersContext }
    ]);

    mountOrpc("/dashboard", [{ handler: orpcHandler, getContext: headersContext }]);

    mountOrpc("/registry/docs", [
        { handler: docsV1ReadHandler, getContext: headersContext },
        { handler: docsV1WriteHandler, getContext: headersContext }
    ]);

    mountOrpc("/generators", [{ handler: generatorsRootHandler, getContext: headersContext }]);

    await fastifyApp.listen({ port, host: "0.0.0.0" });
    console.log(`Mock FDR server running on http://localhost:${port}/`);
    return {
        authedClient,
        unauthedClient,
        prisma,
        app: fdrApplication,
        fastifyApp,
        port
    };
}
