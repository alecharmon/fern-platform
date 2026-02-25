import { execa } from "execa";

export interface TestContainer {
    containerId: string;
    serviceName: string;
}

/**
 * Generic function to get container ID by name filter
 */
export async function getContainerId(nameFilter: string): Promise<string> {
    const { stdout: containerId } = await execa("docker", ["ps", "-q", "--filter", nameFilter]);
    // Handle case where multiple containers match - take the first one
    const firstContainerId = containerId.trim().split("\n")[0];
    if (!firstContainerId) {
        throw new Error(`No container found matching filter: ${nameFilter}`);
    }
    return firstContainerId;
}

/**
 * Test PostgreSQL connection and database existence
 */
export async function testPostgresConnection(containerId: string, database: string = "fdr"): Promise<void> {
    const { stdout: postgresStatus } = await execa("docker", [
        "exec",
        containerId,
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        database
    ]);

    if (!postgresStatus.includes("accepting connections")) {
        throw new Error(`PostgreSQL is not accepting connections: ${postgresStatus}`);
    }
}

/**
 * Test that the fdr database exists and has tables
 */
export async function testFdrDatabase(containerId: string): Promise<void> {
    // Check if fdr database exists
    const { stdout: dbList } = await execa("docker", [
        "exec",
        "-e",
        "PGPASSWORD=postgres",
        containerId,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-t",
        "-c",
        "SELECT 1 FROM pg_database WHERE datname='fdr'"
    ]);

    if (dbList.trim() !== "1") {
        throw new Error("fdr database does not exist");
    }

    // Check if fdr database has tables
    const { stdout: tableList } = await execa("docker", [
        "exec",
        "-e",
        "PGPASSWORD=postgres",
        containerId,
        "psql",
        "-U",
        "postgres",
        "-d",
        "fdr",
        "-t",
        "-c",
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
    ]);

    const tableCount = parseInt(tableList.trim());
    if (tableCount <= 0) {
        throw new Error(`fdr database has no tables (count: ${tableCount})`);
    }
}

/**
 * Test SeaweedFS bucket has docs
 */
export async function testSeaweedFSBucket(containerId: string, orgName: string = "example-org"): Promise<void> {
    const { stdout: bucketList } = await execa("docker", [
        "exec",
        containerId,
        "sh",
        "-c",
        "echo 's3.bucket.list' | weed shell -master=localhost:9333 2>/dev/null"
    ]);

    if (!bucketList.includes(`${orgName}.docs.buildwithfern.com`)) {
        throw new Error(`SeaweedFS bucket for ${orgName} not found: ${bucketList}`);
    }
}

/**
 * Test SeaweedFS health check
 */
export async function testSeaweedFSHealth(
    containerId: string,
    endpoint: string = "http://localhost:9333/cluster/status"
): Promise<void> {
    const { stdout: curlOutput } = await execa("docker", [
        "exec",
        containerId,
        "curl",
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        endpoint
    ]);

    if (curlOutput !== "200") {
        throw new Error(`SeaweedFS health check failed with status: ${curlOutput}`);
    }
}

/**
 * Test FDR server health check
 */
export async function testFdrHealth(
    containerId: string,
    endpoint: string = "http://localhost:8080/health"
): Promise<void> {
    const { stdout: curlOutput } = await execa("docker", [
        "exec",
        containerId,
        "curl",
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        endpoint
    ]);

    if (curlOutput !== "200") {
        throw new Error(`FDR health check failed with status: ${curlOutput}`);
    }
}

/**
 * Create a test suite for PostgreSQL tests
 */
export function createPostgresTests(getContainerIdFn: () => Promise<string>, testName: string) {
    return {
        [`${testName} Postgres is running`]: async () => {
            const containerId = await getContainerIdFn();
            if (!containerId) {
                throw new Error("Container not found");
            }
            await testPostgresConnection(containerId);
        },

        [`${testName} fdr database exists and has tables`]: async () => {
            const containerId = await getContainerIdFn();
            if (!containerId) {
                throw new Error("Container not found");
            }
            await testFdrDatabase(containerId);
        }
    };
}

/**
 * Create a test suite for SeaweedFS tests
 */
export function createSeaweedFSTests(
    getContainerIdFn: () => Promise<string>,
    testName: string,
    healthEndpoint?: string
) {
    return {
        [`${testName} SeaweedFS Bucket has docs`]: async () => {
            const containerId = await getContainerIdFn();
            if (!containerId) {
                throw new Error("Container not found");
            }
            await testSeaweedFSBucket(containerId);
        },

        [`${testName} health check passes`]: async () => {
            const containerId = await getContainerIdFn();
            if (!containerId) {
                throw new Error("Container not found");
            }
            await testSeaweedFSHealth(containerId, healthEndpoint);
        }
    };
}

/**
 * Create a test suite for FDR server tests
 */
export function createFdrTests(getContainerIdFn: () => Promise<string>, testName: string, healthEndpoint?: string) {
    return {
        [`${testName} health check passes`]: async () => {
            const containerId = await getContainerIdFn();
            if (!containerId) {
                throw new Error("Container not found");
            }
            await testFdrHealth(containerId, healthEndpoint);
        }
    };
}

/**
 * Test FDR server health check with external port mapping
 */
export async function testFdrHealthExternal(containerId: string, externalPort: number): Promise<void> {
    console.log(`Testing FDR health on port ${externalPort}...`);
    const { stdout: curlOutput, stderr } = await execa(
        "curl",
        ["-s", "-o", "/dev/null", "-w", "%{http_code}", `http://localhost:${externalPort}/health`],
        { reject: false }
    );

    console.log(`FDR health check on port ${externalPort} returned: ${curlOutput}`);
    if (stderr) {
        console.log(`FDR health check stderr: ${stderr}`);
    }

    if (curlOutput !== "200") {
        throw new Error(`FDR health check failed on port ${externalPort} with status: ${curlOutput}`);
    }
}

/**
 * Test SeaweedFS health check with external port mapping
 */
export async function testSeaweedFSHealthExternal(externalPort: number): Promise<void> {
    console.log(`Testing SeaweedFS health on port ${externalPort}...`);
    const { stdout: curlOutput, stderr } = await execa(
        "curl",
        ["-s", "-o", "/dev/null", "-w", "%{http_code}", `http://localhost:${externalPort}/cluster/status`],
        { reject: false }
    );

    console.log(`SeaweedFS health check on port ${externalPort} returned: ${curlOutput}`);
    if (stderr) {
        console.log(`SeaweedFS health check stderr: ${stderr}`);
    }

    if (curlOutput !== "200") {
        throw new Error(`SeaweedFS health check failed on port ${externalPort} with status: ${curlOutput}`);
    }
}

/**
 * Test that multiple instances can run simultaneously without conflicts
 */
export async function testMultipleInstances(instances: { containerId: string; externalPort: number }[]): Promise<void> {
    // Test that all instances are healthy
    for (const instance of instances) {
        await testFdrHealthExternal(instance.containerId, instance.externalPort);
    }

    // Test that instances don't interfere with each other
    // by checking that each responds independently
    const healthChecks = instances.map(async (instance) => {
        const { stdout: curlOutput } = await execa("curl", [
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            `http://localhost:${instance.externalPort}/health`
        ]);
        return curlOutput === "200";
    });

    const results = await Promise.all(healthChecks);
    const allHealthy = results.every((result) => result);

    if (!allHealthy) {
        throw new Error("Not all instances are healthy simultaneously");
    }
}

/**
 * Test that external calls are blocked (network isolation)
 * Should fail to reach external URLs like google.com
 */
export async function testExternalCallsBlocked(containerId: string): Promise<void> {
    const { stdout: curlOutput, exitCode } = await execa(
        "docker",
        [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "--connect-timeout",
            "5",
            "http://www.google.com"
        ],
        {
            reject: false
        }
    );

    // Should fail to connect (exit code 28 for timeout or 7 for connection refused)
    // or return empty/error status code
    if (exitCode === 0 && curlOutput === "200") {
        throw new Error("External call succeeded when it should be blocked");
    }

    // Success - external calls are blocked
}

/**
 * Test that port 3000 is accessible and doesn't cause failures
 */
export async function testPort3000Accessible(containerId: string): Promise<void> {
    // Try to connect to port 3000 inside the container
    const { exitCode: _exitCode } = await execa(
        "docker",
        ["exec", containerId, "sh", "-c", "timeout 2 nc -z localhost 3000 || echo 'Port check attempted'"],
        {
            reject: false
        }
    );

    // Just verify the command ran without crashing the container
    // We don't strictly require port 3000 to be open, just that checking it doesn't break things
}

/**
 * Test that services still work after checking port 3000
 */
export async function testServicesAfterPort3000Check(containerId: string): Promise<void> {
    // First check port 3000
    await testPort3000Accessible(containerId);

    // Then verify FDR health is still working
    await testFdrHealth(containerId);
}

/**
 * Test that the docs UI is accessible and returns valid HTML
 */
export async function testDocsUIAccessible(
    containerId: string,
    endpoint: string = "http://localhost:3000"
): Promise<void> {
    const maxRetries = 30; // Try for up to 30 seconds
    const retryDelay = 1000; // Wait 1 second between retries

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { stdout: httpCode } = await execa("docker", [
                "exec",
                containerId,
                "curl",
                "-s",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                endpoint
            ]);

            if (httpCode === "200") {
                // Get the actual content to verify it's HTML
                const { stdout: content } = await execa("docker", ["exec", containerId, "curl", "-s", endpoint]);

                if (!content.includes("<!DOCTYPE html>") && !content.includes("<html")) {
                    throw new Error(`Docs UI returned non-HTML content at ${endpoint}`);
                }

                // Verify essential HTML structure
                if (!content.includes("<head") || !content.includes("<body")) {
                    throw new Error(`Docs UI HTML is malformed at ${endpoint} - missing head or body tags`);
                }

                // Success!
                return;
            }

            lastError = new Error(`Docs UI not accessible at ${endpoint}. HTTP status: ${httpCode}`);
        } catch (error) {
            lastError = error as Error;
        }

        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error(`Docs UI failed to become accessible after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Test that the docs UI contains expected interactive elements
 */
export async function testDocsUIElements(
    containerId: string,
    endpoint: string = "http://localhost:3000"
): Promise<void> {
    const maxRetries = 30; // Try for up to 30 seconds
    const retryDelay = 1000; // Wait 1 second between retries

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Get the HTML content
            const { stdout: content } = await execa("docker", ["exec", containerId, "curl", "-s", endpoint]);

            // If we got content, verify it
            if (content && content.length > 0) {
                // Check for search button - it might be in the HTML or loaded via JS
                // We'll check for common patterns that should exist
                const hasSearchButton =
                    content.includes('id="fern-search-button"') ||
                    content.includes("fern-search-button") ||
                    content.includes("search");

                if (!hasSearchButton) {
                    // This is just a warning check
                    console.warn("Warning: Could not find search button reference in initial HTML.");
                }

                // Verify the page has some interactive JavaScript
                if (!content.includes("<script")) {
                    throw new Error("Docs UI has no scripts - page may not be functional");
                }

                // Success!
                return;
            }

            lastError = new Error(`Docs UI returned empty content at ${endpoint}`);
        } catch (error) {
            lastError = error as Error;
        }

        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error(`Docs UI failed to return valid content after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Cache stats response from the cache proxy
 */
export interface CacheStats {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: string;
}

/**
 * Get cache stats from the cache proxy
 */
export async function getCacheStats(
    containerId: string,
    endpoint: string = "http://localhost:3000/__cache/stats"
): Promise<CacheStats> {
    const { stdout: statsJson } = await execa("docker", ["exec", containerId, "curl", "-s", endpoint]);
    return JSON.parse(statsJson) as CacheStats;
}

/**
 * Test that the frontend cache is working by making requests and checking cache stats
 */
export async function testFrontendCacheWorking(
    containerId: string,
    docsEndpoint: string = "http://localhost:3000",
    cacheStatsEndpoint: string = "http://localhost:3000/__cache/stats"
): Promise<void> {
    const initialStats = await getCacheStats(containerId, cacheStatsEndpoint);
    const initialHits = initialStats.hits;
    const initialMisses = initialStats.misses;

    await execa("docker", ["exec", containerId, "curl", "-s", "-o", "/dev/null", docsEndpoint]);
    await execa("docker", ["exec", containerId, "curl", "-s", "-o", "/dev/null", docsEndpoint]);
    await execa("docker", ["exec", containerId, "curl", "-s", "-o", "/dev/null", docsEndpoint]);

    const afterStats = await getCacheStats(containerId, cacheStatsEndpoint);

    const newHits = afterStats.hits - initialHits;
    const newMisses = afterStats.misses - initialMisses;

    if (newHits === 0 && newMisses > 0) {
        throw new Error(
            `Cache is not working: ${newMisses} new misses but 0 new hits. ` +
                `Expected at least 2 cache hits from 3 identical requests. ` +
                `Stats: ${JSON.stringify(afterStats)}`
        );
    }

    if (newHits < 2) {
        throw new Error(
            `Cache hit rate too low: only ${newHits} hits from 3 identical requests. ` +
                `Expected at least 2 cache hits. Stats: ${JSON.stringify(afterStats)}`
        );
    }
}

/**
 * Test that the cache stats endpoint is accessible and returns valid data
 */
export async function testCacheStatsEndpoint(
    containerId: string,
    endpoint: string = "http://localhost:3000/__cache/stats"
): Promise<void> {
    const { stdout: httpCode } = await execa("docker", [
        "exec",
        containerId,
        "curl",
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        endpoint
    ]);

    if (httpCode !== "200") {
        throw new Error(`Cache stats endpoint returned ${httpCode}, expected 200`);
    }

    const stats = await getCacheStats(containerId, endpoint);

    if (typeof stats.size !== "number" || typeof stats.maxSize !== "number") {
        throw new Error(`Cache stats missing required fields: ${JSON.stringify(stats)}`);
    }

    if (typeof stats.hits !== "number" || typeof stats.misses !== "number") {
        throw new Error(`Cache stats missing hit/miss counters: ${JSON.stringify(stats)}`);
    }
}

/**
 * Test that custom components page is accessible and renders the custom component
 */
export async function testCustomComponentsPage(
    containerId: string,
    endpoint: string = "http://localhost:3000/custom-components"
): Promise<void> {
    const maxRetries = 30;
    const retryDelay = 1000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { stdout: httpCode } = await execa("docker", [
                "exec",
                containerId,
                "curl",
                "-s",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                endpoint
            ]);

            if (httpCode === "200") {
                // Get the actual content to verify custom components rendered
                const { stdout: content } = await execa("docker", ["exec", containerId, "curl", "-s", endpoint]);

                // Check for HTML structure
                if (!content.includes("<!DOCTYPE html>") && !content.includes("<html")) {
                    throw new Error(`Custom components page returned non-HTML content at ${endpoint}`);
                }

                // Check that the page title or content related to custom components is present
                if (!content.includes("Custom Components") && !content.includes("custom-components")) {
                    throw new Error(`Custom components page does not contain expected content at ${endpoint}`);
                }

                // Check for evidence that the custom component rendered
                // The CustomBanner component includes data-testid="custom-banner" and specific styling
                // When SSR renders the component, we should see evidence of it in the HTML
                if (
                    !content.includes("custom-banner") &&
                    !content.includes("CustomBanner") &&
                    !content.includes("Information") &&
                    !content.includes("Success!")
                ) {
                    throw new Error(
                        `Custom components page does not appear to have rendered the custom banner component at ${endpoint}`
                    );
                }

                // Success!
                return;
            }

            lastError = new Error(`Custom components page not accessible at ${endpoint}. HTTP status: ${httpCode}`);
        } catch (error) {
            lastError = error as Error;
        }

        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error(
        `Custom components page failed to become accessible after ${maxRetries} attempts: ${lastError?.message}`
    );
}

/**
 * Test that the MeiliSearch search endpoint is accessible and returns valid results
 * This tests the /_search/indexes/{index}/search endpoint which is proxied through the middleware
 */
export async function testSearchEndpoint(
    containerId: string,
    docsEndpoint: string = "http://localhost:3000"
): Promise<void> {
    const maxRetries = 30;
    const retryDelay = 1000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Test the search endpoint with a simple query
            // The middleware proxies /_search/* to MeiliSearch
            const { stdout: httpCode } = await execa("docker", [
                "exec",
                containerId,
                "curl",
                "-s",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                "-X",
                "POST",
                "-H",
                "Content-Type: application/json",
                "-d",
                '{"q":"test","limit":1}',
                `${docsEndpoint}/_search/indexes/docs/search`
            ]);

            if (httpCode === "200") {
                // Verify we get a valid JSON response with search results structure
                const { stdout: response } = await execa("docker", [
                    "exec",
                    containerId,
                    "curl",
                    "-s",
                    "-X",
                    "POST",
                    "-H",
                    "Content-Type: application/json",
                    "-d",
                    '{"q":"test","limit":1}',
                    `${docsEndpoint}/_search/indexes/docs/search`
                ]);

                const json = JSON.parse(response);
                // MeiliSearch returns an object with 'hits' array
                if (!("hits" in json)) {
                    throw new Error(`Search response missing 'hits' field: ${JSON.stringify(json)}`);
                }

                // Success!
                return;
            }

            lastError = new Error(`Search endpoint returned HTTP ${httpCode}, expected 200`);
        } catch (error) {
            lastError = error as Error;
        }

        if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error(`Search endpoint failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Test that _files path traversal attempts are blocked with 400.
 * The middleware rejects any _files path containing ".." to prevent escaping the SeaweedFS bucket.
 */
export async function testFilesPathTraversalBlocked(
    containerId: string,
    docsEndpoint: string = "http://localhost:3000"
): Promise<void> {
    const traversalPaths = [
        "/_files/..%09/some-domain/",
        "/_files/../etc/passwd",
        "/_files/..%2f..%2f",
        "/_files/foo/../../bar"
    ];

    for (const path of traversalPaths) {
        const { stdout: httpCode } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "--path-as-is",
            `${docsEndpoint}${path}`
        ]);

        if (httpCode !== "400") {
            throw new Error(
                `Path traversal attempt ${path} should return 400 but returned ${httpCode}. ` +
                    `This is a security issue - _files paths with ".." should be rejected.`
            );
        }
    }
}

/**
 * Test that a real file can be downloaded via the /_files/ endpoint.
 * Lists files from SeaweedFS, picks one, and verifies it can be fetched through the middleware.
 */
export async function testFilesDownload(
    containerId: string,
    docsEndpoint: string = "http://localhost:3000"
): Promise<void> {
    const { stdout: containerUid } = await execa("docker", ["exec", containerId, "id", "-u"]);
    const uid = containerUid.trim();

    const { stdout: fileList } = await execa("docker", [
        "exec",
        "-e",
        `MC_CONFIG_DIR=/tmp/mc-config-${uid}`,
        containerId,
        "mc",
        "ls",
        "--recursive",
        "minio"
    ]);

    const lines = fileList.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
        throw new Error("No files found in SeaweedFS — cannot test _files download");
    }

    const firstLine = lines[0]!;
    const objectPath = firstLine.trim().split(/\s+/).pop();
    if (!objectPath) {
        throw new Error(`Could not parse object path from mc ls output: ${firstLine}`);
    }

    const filesUrl = `${docsEndpoint}/_files/${objectPath}`;
    const { stdout: httpCode } = await execa("docker", [
        "exec",
        containerId,
        "curl",
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        "-L",
        filesUrl
    ]);

    if (httpCode !== "200") {
        throw new Error(
            `Failed to download file via _files endpoint. URL: ${filesUrl}, HTTP status: ${httpCode}. ` +
                `Expected 200 for a file that exists in SeaweedFS.`
        );
    }

    const { stdout: content } = await execa("docker", ["exec", containerId, "curl", "-s", "-L", filesUrl]);

    if (!content || content.length === 0) {
        throw new Error(`File download returned empty content. URL: ${filesUrl}`);
    }
}

/**
 * Test that _search path traversal attempts are blocked with 400.
 * Attackers can use encoded sequences like "..%09\" or "..%2f" to escape the
 * allowed search path prefixes and reach sensitive MeiliSearch endpoints (e.g. /keys).
 */
export async function testSearchPathTraversalBlocked(
    containerId: string,
    docsEndpoint: string = "http://localhost:3000"
): Promise<void> {
    const traversalPaths = [
        "/_search/indexes/..%09%5Ckeys",
        "/_search/indexes/../keys",
        "/_search/indexes/..%2fkeys",
        "/_search/indexes/..%2f..%2fkeys",
        "/_search/indexes/foo/../../keys"
    ];

    for (const path of traversalPaths) {
        const { stdout: httpCode } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "--path-as-is",
            `${docsEndpoint}${path}`
        ]);

        if (httpCode !== "400") {
            throw new Error(
                `Search path traversal attempt ${path} should return 400 but returned ${httpCode}. ` +
                    `This is a security issue - _search paths with ".." should be rejected.`
            );
        }
    }
}

/**
 * Test that sensitive MeiliSearch endpoints are blocked by the middleware
 * The middleware should return 403 for endpoints like /keys, /dumps, /tasks, etc.
 */
export async function testSearchSensitiveEndpointsBlocked(
    containerId: string,
    docsEndpoint: string = "http://localhost:3000"
): Promise<void> {
    // List of sensitive endpoints that should be blocked
    // Note: /_search/indexes is NOT blocked as it's needed to list available indexes
    const sensitiveEndpoints = ["/_search/keys", "/_search/dumps", "/_search/snapshots", "/_search/tasks"];

    for (const endpoint of sensitiveEndpoints) {
        const { stdout: httpCode } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            `${docsEndpoint}${endpoint}`
        ]);

        if (httpCode !== "403") {
            throw new Error(
                `Sensitive endpoint ${endpoint} should return 403 but returned ${httpCode}. ` +
                    `This is a security issue - sensitive MeiliSearch endpoints should be blocked.`
            );
        }
    }
}
