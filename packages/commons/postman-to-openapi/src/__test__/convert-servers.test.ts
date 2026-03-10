import { describe, expect, it } from "vitest";

import { extractServers } from "../convert-servers.js";
import type { PostmanItemOrGroup } from "../postman-types.js";

describe("extractServers", () => {
    it("extracts unique servers from items", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"]
                    }
                }
            },
            {
                name: "Get Posts",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/posts",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["posts"]
                    }
                }
            }
        ];

        const servers = extractServers(items);
        expect(servers).toHaveLength(1);
        expect(servers[0]!.url).toBe("https://api.example.com");
    });

    it("extracts multiple unique servers", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"]
                    }
                }
            },
            {
                name: "Get Docs",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://docs.example.com/pages",
                        protocol: "https",
                        host: ["docs", "example", "com"],
                        path: ["pages"]
                    }
                }
            }
        ];

        const servers = extractServers(items);
        expect(servers).toHaveLength(2);
    });

    it("resolves collection variables in server URLs", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "{{baseUrl}}/users",
                        host: ["{{baseUrl}}"],
                        path: ["users"]
                    }
                }
            }
        ];

        const servers = extractServers(items, [{ key: "baseUrl", value: "https://api.example.com" }]);
        expect(servers).toHaveLength(1);
        expect(servers[0]!.url).toBe("https://api.example.com");
    });

    it("extracts servers from nested groups", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Users",
                item: [
                    {
                        name: "Get Users",
                        request: {
                            method: "GET",
                            url: {
                                raw: "https://api.example.com/users",
                                protocol: "https",
                                host: ["api", "example", "com"],
                                path: ["users"]
                            }
                        }
                    }
                ]
            }
        ];

        const servers = extractServers(items);
        expect(servers).toHaveLength(1);
        expect(servers[0]!.url).toBe("https://api.example.com");
    });

    it("handles items with string requests", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Simple request",
                request: "https://api.example.com/test"
            }
        ];

        const servers = extractServers(items);
        expect(servers).toHaveLength(0);
    });

    it("includes server variables for unresolved placeholders", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "{{baseUrl}}/users",
                        host: ["{{baseUrl}}"],
                        path: ["users"]
                    }
                }
            }
        ];

        const servers = extractServers(items);
        expect(servers.length).toBeGreaterThan(0);
    });
});
