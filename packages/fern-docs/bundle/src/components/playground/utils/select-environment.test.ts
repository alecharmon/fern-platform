import type { Environment, EnvironmentId } from "@fern-api/fdr-sdk/api-definition";
import { describe, expect, it } from "vitest";

import { filterEnvironmentsByAudience } from "./select-environment";

function createEnvironment(id: string, audiences?: string[]): Environment {
    return {
        id: id as EnvironmentId,
        baseUrl: `https://${id}.example.com`,
        audiences
    };
}

describe("filterEnvironmentsByAudience", () => {
    describe("when environments is undefined", () => {
        it("should return undefined", () => {
            expect(filterEnvironmentsByAudience(undefined, [])).toBeUndefined();
            expect(filterEnvironmentsByAudience(undefined, ["admin"])).toBeUndefined();
        });
    });

    describe("when environments have no audiences defined", () => {
        it("should return all environments (accessible to everyone)", () => {
            const environments = [createEnvironment("production"), createEnvironment("staging")];

            expect(filterEnvironmentsByAudience(environments, [])).toEqual(environments);
            expect(filterEnvironmentsByAudience(environments, ["admin"])).toEqual(environments);
        });

        it("should return environments with empty audiences array (accessible to everyone)", () => {
            const environments = [createEnvironment("production", []), createEnvironment("staging", [])];

            expect(filterEnvironmentsByAudience(environments, [])).toEqual(environments);
            expect(filterEnvironmentsByAudience(environments, ["admin"])).toEqual(environments);
        });
    });

    describe("when environments have audiences defined", () => {
        it("should filter out environments when user has no roles", () => {
            const production = createEnvironment("production", ["external"]);
            const staging = createEnvironment("staging", ["internal"]);
            const environments = [production, staging];

            expect(filterEnvironmentsByAudience(environments, [])).toEqual([]);
        });

        it("should show environments that match user roles", () => {
            const production = createEnvironment("production", ["external"]);
            const staging = createEnvironment("staging", ["internal"]);
            const environments = [production, staging];

            expect(filterEnvironmentsByAudience(environments, ["external"])).toEqual([production]);
            expect(filterEnvironmentsByAudience(environments, ["internal"])).toEqual([staging]);
            expect(filterEnvironmentsByAudience(environments, ["external", "internal"])).toEqual(environments);
        });

        it("should match if user has any of the environment's audiences", () => {
            const multiAudienceEnv = createEnvironment("special", ["admin", "beta-tester", "partner"]);
            const environments = [multiAudienceEnv];

            expect(filterEnvironmentsByAudience(environments, ["admin"])).toEqual(environments);
            expect(filterEnvironmentsByAudience(environments, ["beta-tester"])).toEqual(environments);
            expect(filterEnvironmentsByAudience(environments, ["partner"])).toEqual(environments);
            expect(filterEnvironmentsByAudience(environments, ["regular-user"])).toEqual([]);
        });
    });

    describe("mixed environments (some with audiences, some without)", () => {
        it("should show public environments to all users, audience-restricted only to matching users", () => {
            const publicEnv = createEnvironment("production");
            const internalEnv = createEnvironment("staging", ["internal"]);
            const devEnv = createEnvironment("development", ["developers"]);
            const environments = [publicEnv, internalEnv, devEnv];

            // Anonymous user sees only public
            expect(filterEnvironmentsByAudience(environments, [])).toEqual([publicEnv]);

            // Internal user sees public + internal
            expect(filterEnvironmentsByAudience(environments, ["internal"])).toEqual([publicEnv, internalEnv]);

            // Developer sees public + dev
            expect(filterEnvironmentsByAudience(environments, ["developers"])).toEqual([publicEnv, devEnv]);

            // User with all roles sees everything
            expect(filterEnvironmentsByAudience(environments, ["internal", "developers"])).toEqual(environments);
        });
    });

    describe("real-world scenario: Prolific use case", () => {
        it("should filter servers based on instance audiences", () => {
            // Prolific has two docs instances:
            // - Public instance with audience: ["external"]
            // - Internal instance with audience: ["internal"]
            //
            // They have servers with x-fern-audiences:
            // - Production server: audiences: ["external"]
            // - Staging server: audiences: ["internal"]

            const productionServer = createEnvironment("Production", ["external"]);
            const stagingServer = createEnvironment("Staging", ["internal"]);
            const environments = [productionServer, stagingServer];

            // Public docs instance user (has "external" role)
            // Should only see Production server
            expect(filterEnvironmentsByAudience(environments, ["external"])).toEqual([productionServer]);

            // Internal docs instance user (has "internal" role)
            // Should only see Staging server
            expect(filterEnvironmentsByAudience(environments, ["internal"])).toEqual([stagingServer]);

            // Admin user with both roles
            // Should see both servers
            expect(filterEnvironmentsByAudience(environments, ["external", "internal"])).toEqual(environments);
        });
    });
});
