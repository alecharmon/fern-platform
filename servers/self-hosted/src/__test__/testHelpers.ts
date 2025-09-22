import { execa } from "execa";

export interface TestContainer {
  containerId: string;
  serviceName: string;
}

/**
 * Generic function to get container ID by name filter
 */
export async function getContainerId(nameFilter: string): Promise<string> {
  const { stdout: containerId } = await execa("docker", [
    "ps",
    "-q",
    "--filter",
    nameFilter,
  ]);
  return containerId;
}

/**
 * Test PostgreSQL connection and database existence
 */
export async function testPostgresConnection(
  containerId: string,
  database: string = "fdr"
): Promise<void> {
  const { stdout: postgresStatus } = await execa("docker", [
    "exec",
    containerId,
    "pg_isready",
    "-U",
    "postgres",
    "-d",
    database,
  ]);

  if (!postgresStatus.includes("accepting connections")) {
    throw new Error(
      `PostgreSQL is not accepting connections: ${postgresStatus}`
    );
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
    "SELECT 1 FROM pg_database WHERE datname='fdr'",
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
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'",
  ]);

  const tableCount = parseInt(tableList.trim());
  if (tableCount <= 0) {
    throw new Error(`fdr database has no tables (count: ${tableCount})`);
  }
}

/**
 * Test MinIO bucket has docs
 */
export async function testMinioBucket(
  containerId: string,
  orgName: string = "example-org"
): Promise<void> {
  const { stdout: minioStatus } = await execa("docker", [
    "exec",
    containerId,
    "mc",
    "ls",
    "minio",
  ]);

  if (!minioStatus.includes(`${orgName}.docs.buildwithfern.com`)) {
    throw new Error(`MinIO bucket for ${orgName} not found: ${minioStatus}`);
  }
}

/**
 * Test MinIO health check
 */
export async function testMinioHealth(
  containerId: string,
  endpoint: string = "http://localhost:9000/minio/health/live"
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
    endpoint,
  ]);

  if (curlOutput !== "200") {
    throw new Error(`MinIO health check failed with status: ${curlOutput}`);
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
    endpoint,
  ]);

  if (curlOutput !== "200") {
    throw new Error(`FDR health check failed with status: ${curlOutput}`);
  }
}

/**
 * Create a test suite for PostgreSQL tests
 */
export function createPostgresTests(
  getContainerIdFn: () => Promise<string>,
  testName: string
) {
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
    },
  };
}

/**
 * Create a test suite for MinIO tests
 */
export function createMinioTests(
  getContainerIdFn: () => Promise<string>,
  testName: string,
  healthEndpoint?: string
) {
  return {
    [`${testName} Minio Bucket has docs`]: async () => {
      const containerId = await getContainerIdFn();
      if (!containerId) {
        throw new Error("Container not found");
      }
      await testMinioBucket(containerId);
    },

    [`${testName} health check passes`]: async () => {
      const containerId = await getContainerIdFn();
      if (!containerId) {
        throw new Error("Container not found");
      }
      await testMinioHealth(containerId, healthEndpoint);
    },
  };
}

/**
 * Create a test suite for FDR server tests
 */
export function createFdrTests(
  getContainerIdFn: () => Promise<string>,
  testName: string,
  healthEndpoint?: string
) {
  return {
    [`${testName} health check passes`]: async () => {
      const containerId = await getContainerIdFn();
      if (!containerId) {
        throw new Error("Container not found");
      }
      await testFdrHealth(containerId, healthEndpoint);
    },
  };
}

/**
 * Test FDR server health check with external port mapping
 */
export async function testFdrHealthExternal(
  containerId: string,
  externalPort: number
): Promise<void> {
  const { stdout: curlOutput } = await execa("curl", [
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    `http://localhost:${externalPort}/health`,
  ]);

  if (curlOutput !== "200") {
    throw new Error(
      `FDR health check failed on port ${externalPort} with status: ${curlOutput}`
    );
  }
}

/**
 * Test MinIO health check with external port mapping
 */
export async function testMinioHealthExternal(
  externalPort: number
): Promise<void> {
  const { stdout: curlOutput } = await execa("curl", [
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    `http://localhost:${externalPort}/minio/health/live`,
  ]);

  if (curlOutput !== "200") {
    throw new Error(
      `MinIO health check failed on port ${externalPort} with status: ${curlOutput}`
    );
  }
}

/**
 * Test that multiple instances can run simultaneously without conflicts
 */
export async function testMultipleInstances(
  instances: Array<{ containerId: string; externalPort: number }>
): Promise<void> {
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
      `http://localhost:${instance.externalPort}/health`,
    ]);
    return curlOutput === "200";
  });

  const results = await Promise.all(healthChecks);
  const allHealthy = results.every((result) => result);

  if (!allHealthy) {
    throw new Error("Not all instances are healthy simultaneously");
  }
}
