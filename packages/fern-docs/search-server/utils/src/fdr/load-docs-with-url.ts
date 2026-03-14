import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
    ApiDefinition,
    type DocsV1Read,
    type DocsV2Read,
    type FdrAPI,
    FdrClient,
    FernNavigation
} from "@fern-api/fdr-sdk";
import { getS3KeyForV1DocsDefinition } from "@fern-api/fdr-sdk/docs";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { mapValues } from "es-toolkit/object";

export interface LoadDocsWithUrlPayload {
    /**
     * FDR environment to use. (either `https://registry-dev2.buildwithfern.com` or `https://registry.buildwithfern.com`)
     */
    environment: string;

    /**
     * The shared secret token use to authenticate with FDR.
     */
    fernToken: string;

    /**
     * The domain to load docs for.
     */
    domain: string;

    isBatchStreamToggleDisabled?: boolean;
}

export interface LoadDocsWithUrlResponse {
    org_id: FernNavigation.OrgId;
    root: FernNavigation.RootNode;
    pages: Record<FernNavigation.PageId, string>;
    apis: Record<ApiDefinition.ApiDefinitionId, ApiDefinition.ApiDefinition>;
    domain: string;
    basepath: string | undefined;
}

export async function loadDocsWithUrl(payload: LoadDocsWithUrlPayload): Promise<LoadDocsWithUrlResponse> {
    const parsedUrl = new URL(withDefaultProtocol(payload.domain));
    const domain = parsedUrl.host;
    const basepath = parsedUrl.pathname !== "/" ? parsedUrl.pathname : undefined;

    let docsBody: DocsV2Read.LoadDocsForUrlResponse;
    const s3Response = await loadDocsDefinitionFromS3(domain, basepath);
    if (s3Response != null) {
        console.log(`[loadDocsWithUrl] Loaded docs from S3 for ${domain}${basepath ?? ""}`);
        docsBody = s3Response;
    } else {
        console.warn(`[loadDocsWithUrl] S3 load failed for ${domain}${basepath ?? ""}, falling back to FDR API`);
        docsBody = await loadDocsFromFdr(payload);
    }

    const org_id = (docsBody as any).orgId as FernNavigation.OrgId;

    const root = FernNavigation.utils.toRootNode(docsBody, payload.isBatchStreamToggleDisabled ?? false);

    const pages = retrieveMarkdownFromPages(
        docsBody.definition.pages as Record<FernNavigation.PageId, DocsV1Read.PageContent>
    );

    const apis = {
        ...mapValues(docsBody.definition.apis, (api) =>
            ApiDefinition.ApiDefinitionV1ToLatest.from(api as any).migrate()
        ),
        ...(docsBody.definition.apisV2 as Record<string, ApiDefinition.ApiDefinition> | undefined)
    };

    return { org_id, root, pages, apis, domain, basepath };
}

async function loadDocsFromFdr(payload: LoadDocsWithUrlPayload): Promise<DocsV2Read.LoadDocsForUrlResponse> {
    const client = new FdrClient({
        environment: payload.environment,
        token: payload.fernToken
    });

    const url = withDefaultProtocol(payload.domain);
    try {
        const docs = await client.docs.v2.read.getDocsForUrl({ url });
        return docs as DocsV2Read.LoadDocsForUrlResponse;
    } catch (e: unknown) {
        throw new Error(`Failed to get docs for ${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
}

async function loadDocsDefinitionFromS3(
    domain: string,
    basepath: string | undefined
): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse | undefined> {
    // Self-hosted: load from SeaweedFS (S3-compatible) using S3_ENDPOINT / S3_BUCKET_NAME
    const s3Endpoint = process.env.S3_ENDPOINT;
    const selfHostedBucket = process.env.S3_BUCKET_NAME;
    if (s3Endpoint && selfHostedBucket) {
        return loadDocsFromS3Compat(s3Endpoint, selfHostedBucket);
    }

    const bucketName = process.env.DOCS_DEFINITION_S3_BUCKET_NAME;
    if (!bucketName) {
        console.error("[loadDocsDefinitionFromS3] DOCS_DEFINITION_S3_BUCKET_NAME env variable is not set");
        return undefined;
    }
    const s3Key = getS3KeyForV1DocsDefinition(domain, basepath);
    console.log(`[loadDocsDefinitionFromS3] Loading docs from S3: bucket=${bucketName} key=${s3Key}`);

    try {
        const s3ClientConfig: { region: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = {
            region: process.env.AWS_REGION || "us-east-1"
        };

        // Use explicit credentials if available (e.g. Vercel), otherwise fall back to
        // the default credential provider chain (e.g. ECS task roles, EC2 instance profiles)
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        if (accessKeyId && secretAccessKey) {
            s3ClientConfig.credentials = { accessKeyId, secretAccessKey };
        }

        const s3Client = new S3Client(s3ClientConfig);

        const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucketName, Key: s3Key }), {
            expiresIn: 3600
        });

        const response = await fetch(signedUrl);
        if (!response.ok) {
            console.error(`[loadDocsDefinitionFromS3] S3 fetch failed: ${response.status}`);
            return undefined;
        }

        return (await response.json()) as FdrAPI.docs.v2.read.LoadDocsForUrlResponse;
    } catch (error) {
        console.error("[loadDocsDefinitionFromS3] Error loading from S3:", error);
        return undefined;
    }
}

async function loadDocsFromS3Compat(
    endpoint: string,
    bucketName: string
): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse | undefined> {
    try {
        const s3Client = new S3Client({
            endpoint,
            forcePathStyle: true,
            region: "us-east-1"
        });

        const response = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: "v1/fdr.json" }));

        if (!response.Body) {
            console.error("[loadDocsFromS3Compat] Empty response body");
            return undefined;
        }

        const bodyContents = await response.Body.transformToString();
        return JSON.parse(bodyContents) as FdrAPI.docs.v2.read.LoadDocsForUrlResponse;
    } catch (error) {
        console.error("[loadDocsFromS3Compat] Error loading from S3-compatible storage:", error);
        return undefined;
    }
}

function retrieveMarkdownFromPages(pages: Record<FernNavigation.PageId, DocsV1Read.PageContent>) {
    return mapValues(pages, (page) => page.markdown);
}
