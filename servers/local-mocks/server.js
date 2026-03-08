/**
 * Local mock server for Upstash REST API and Vercel Edge Config
 *
 * Upstash REST API: http://localhost:8079
 *   - Translates HTTP requests to Redis commands via ioredis
 *   - Compatible with @upstash/redis SDK
 *
 * Edge Config API: http://localhost:8078
 *   - Serves config from edge-config.json or in-memory defaults
 *   - Compatible with @vercel/edge-config SDK
 */

import express from "express";
import { existsSync, readFileSync } from "fs";
import Redis from "ioredis";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ───────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const UPSTASH_PORT = process.env.UPSTASH_PORT || 8079;
const EDGE_CONFIG_PORT = process.env.EDGE_CONFIG_PORT || 8078;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || "local-dev-token";

// ─── Redis Client ────────────────────────────────────────────────────────────

const redis = new Redis(REDIS_URL);

redis.on("connect", () => {
    console.log("[redis] Connected to", REDIS_URL);
    seedRedis();
});
redis.on("error", (err) => console.error("[redis] Error:", err.message));

// ─── Redis Seed Data ─────────────────────────────────────────────────────────

async function seedRedis() {
    const seedPath = join(__dirname, "redis-seed.json");
    if (!existsSync(seedPath)) {
        console.log("[redis] No redis-seed.json found, skipping seed");
        return;
    }

    try {
        const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));
        let seeded = 0;

        for (const [key, value] of Object.entries(seedData)) {
            if (typeof value === "object" && value !== null) {
                // Hash: HSET key field1 value1 field2 value2 ...
                const pairs = Object.entries(value).flat();
                if (pairs.length > 0) {
                    await redis.hset(key, ...pairs);
                    seeded++;
                }
            } else {
                // String: SET key value
                await redis.set(key, String(value));
                seeded++;
            }
        }

        console.log(`[redis] Seeded ${seeded} keys from redis-seed.json`);
    } catch (e) {
        console.error("[redis] Failed to seed:", e.message);
    }
}

// ─── Edge Config Data ────────────────────────────────────────────────────────

function loadEdgeConfig() {
    const configPath = join(__dirname, "edge-config.json");
    if (existsSync(configPath)) {
        try {
            return JSON.parse(readFileSync(configPath, "utf-8"));
        } catch (e) {
            console.error("[edge-config] Failed to parse edge-config.json:", e.message);
        }
    }
    // Default config for local development
    return {
        // Feature flags (array of domains where feature is enabled)
        whitelabeled: [],
        "seo-disabled": [],
        "seo-enabled": [],
        "dark-code-enabled": [],
        "inline-feedback-enabled": [],
        "grpc-endpoints": [],
        "custom-react-enabled": [],
        "hide-404-page": [],

        // Authentication configs (keyed by domain)
        authentication: {},

        // API key injection configs
        "api-key-injection": {},
        "api-key-injection-demo": {},

        // LaunchDarkly configs
        launchdarkly: {},

        // Dashboard email login
        "dashboard-email-login-supported-platforms": [],
        "dashboard-email-login-connection-to-org": {},

        // Org-level flags
        "bypass-extended-github-auth": []
    };
}

let edgeConfigData = loadEdgeConfig();

// ─── Upstash REST API Server ─────────────────────────────────────────────────

const upstashApp = express();
upstashApp.use(express.json());

// Auth middleware
upstashApp.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const token = auth.slice(7);
    if (token !== UPSTASH_TOKEN) {
        return res.status(401).json({ error: "Invalid token" });
    }
    next();
});

// Upstash uses POST for all commands
// Format: POST /<command>/<key>[/<args...>]
upstashApp.post("/:command/:key?/*", async (req, res) => {
    const { command, key } = req.params;
    const extraArgs = req.params[0] ? req.params[0].split("/") : [];

    try {
        let result;

        switch (command.toLowerCase()) {
            case "hgetall":
                result = await redis.hgetall(key);
                // Convert object to array format [field1, value1, field2, value2, ...]
                const arr = [];
                for (const [k, v] of Object.entries(result || {})) {
                    arr.push(k, v);
                }
                result = arr.length > 0 ? arr : null;
                break;

            case "hkeys":
                result = await redis.hkeys(key);
                break;

            case "hget":
                result = await redis.hget(key, extraArgs[0]);
                break;

            case "hset":
                // Body contains field-value pairs
                if (req.body && typeof req.body === "object") {
                    const pairs = [];
                    for (const [field, value] of Object.entries(req.body)) {
                        pairs.push(field, value);
                    }
                    result = await redis.hset(key, ...pairs);
                } else {
                    result = await redis.hset(key, extraArgs[0], extraArgs[1]);
                }
                break;

            case "get":
                result = await redis.get(key);
                break;

            case "set":
                const value = extraArgs[0];
                const options = {};
                if (extraArgs.includes("EX")) {
                    const exIndex = extraArgs.indexOf("EX");
                    options.EX = parseInt(extraArgs[exIndex + 1], 10);
                }
                result = await redis.set(key, value, ...Object.entries(options).flat());
                break;

            case "del":
                result = await redis.del(key);
                break;

            case "smembers":
                result = await redis.smembers(key);
                break;

            case "sadd":
                result = await redis.sadd(key, ...extraArgs);
                break;

            case "scan":
                const cursor = key || "0";
                const scanOpts = [];
                if (extraArgs.includes("MATCH")) {
                    const matchIndex = extraArgs.indexOf("MATCH");
                    scanOpts.push("MATCH", extraArgs[matchIndex + 1]);
                }
                if (extraArgs.includes("COUNT")) {
                    const countIndex = extraArgs.indexOf("COUNT");
                    scanOpts.push("COUNT", extraArgs[countIndex + 1]);
                }
                result = await redis.scan(cursor, ...scanOpts);
                break;

            default:
                return res.status(400).json({ error: `Unsupported command: ${command}` });
        }

        res.json({ result });
    } catch (err) {
        console.error(`[upstash] Error executing ${command}:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// Health check
upstashApp.get("/health", (req, res) => {
    res.json({ status: "ok", service: "upstash-mock" });
});

// ─── Edge Config API Server ──────────────────────────────────────────────────

const edgeConfigApp = express();
edgeConfigApp.use(express.json());

// GET /items - get all items
edgeConfigApp.get("/items", (req, res) => {
    res.json({ items: edgeConfigData });
});

// GET /item/:key - get single item
edgeConfigApp.get("/item/:key", (req, res) => {
    const { key } = req.params;
    const value = edgeConfigData[key];
    if (value === undefined) {
        return res.status(404).json({ error: "Key not found" });
    }
    res.json(value);
});

// GET /items?keys=key1,key2 - get multiple items
edgeConfigApp.get("/", (req, res) => {
    const keys = req.query.keys?.split(",") || [];
    if (keys.length === 0) {
        return res.json({ items: edgeConfigData });
    }
    const result = {};
    for (const key of keys) {
        if (edgeConfigData[key] !== undefined) {
            result[key] = edgeConfigData[key];
        }
    }
    res.json(result);
});

// PATCH /items - update items (for dashboard writes)
edgeConfigApp.patch("/items", (req, res) => {
    const { items } = req.body;
    if (Array.isArray(items)) {
        for (const item of items) {
            if (item.operation === "upsert") {
                edgeConfigData[item.key] = item.value;
            } else if (item.operation === "delete") {
                delete edgeConfigData[item.key];
            }
        }
    }
    res.json({ status: "ok" });
});

// Reload config from file
edgeConfigApp.post("/reload", (req, res) => {
    edgeConfigData = loadEdgeConfig();
    res.json({ status: "ok", message: "Config reloaded" });
});

// Health check
edgeConfigApp.get("/health", (req, res) => {
    res.json({ status: "ok", service: "edge-config-mock" });
});

// ─── Start Servers ───────────────────────────────────────────────────────────

upstashApp.listen(UPSTASH_PORT, () => {
    console.log(`[upstash-mock] Listening on http://localhost:${UPSTASH_PORT}`);
    console.log(`[upstash-mock] Token: ${UPSTASH_TOKEN}`);
});

edgeConfigApp.listen(EDGE_CONFIG_PORT, () => {
    console.log(`[edge-config-mock] Listening on http://localhost:${EDGE_CONFIG_PORT}`);
});

console.log("\nLocal mocks ready!");
console.log("─".repeat(50));
console.log("Upstash REST API:  http://localhost:" + UPSTASH_PORT);
console.log("Edge Config API:   http://localhost:" + EDGE_CONFIG_PORT);
console.log("─".repeat(50));
