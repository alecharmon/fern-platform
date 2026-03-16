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

// Execute a Redis command given as an array of arguments: ["COMMAND", "arg1", "arg2", ...]
async function executeRedisCommand(args) {
    const command = String(args[0]).toLowerCase();
    const cmdArgs = args.slice(1);

    switch (command) {
        case "hgetall": {
            const obj = await redis.hgetall(cmdArgs[0]);
            const arr = [];
            for (const [k, v] of Object.entries(obj || {})) {
                arr.push(k, v);
            }
            return arr.length > 0 ? arr : null;
        }
        case "hkeys":
            return redis.hkeys(cmdArgs[0]);
        case "hget":
            return redis.hget(cmdArgs[0], cmdArgs[1]);
        case "hdel":
            return redis.hdel(cmdArgs[0], ...cmdArgs.slice(1));
        case "hset": {
            // cmdArgs: [key, field1, value1, field2, value2, ...]
            const key = cmdArgs[0];
            const pairs = cmdArgs.slice(1);
            return redis.hset(key, ...pairs);
        }
        case "get":
            return redis.get(cmdArgs[0]);
        case "set": {
            // cmdArgs: [key, value, ...options]
            return redis.set(...cmdArgs);
        }
        case "setex":
            // cmdArgs: [key, seconds, value]
            return redis.setex(cmdArgs[0], cmdArgs[1], cmdArgs[2]);
        case "del":
            return redis.del(...cmdArgs);
        case "smembers":
            return redis.smembers(cmdArgs[0]);
        case "sadd":
            return redis.sadd(cmdArgs[0], ...cmdArgs.slice(1));
        case "scan": {
            const cursor = cmdArgs[0] || "0";
            return redis.scan(cursor, ...cmdArgs.slice(1));
        }
        default:
            throw new Error(`Unsupported command: ${command}`);
    }
}

// @upstash/redis SDK format: POST / with JSON body ["COMMAND", "arg1", "arg2", ...]
upstashApp.post("/", async (req, res) => {
    const args = req.body;
    if (!Array.isArray(args) || args.length === 0) {
        return res.status(400).json({ error: "Expected JSON array of command arguments" });
    }
    try {
        const result = await executeRedisCommand(args);
        res.json({ result });
    } catch (err) {
        console.error(`[upstash] Error executing ${args[0]}:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// Pipeline format: POST /pipeline with JSON body [["CMD1", ...], ["CMD2", ...], ...]
upstashApp.post("/pipeline", async (req, res) => {
    const commands = req.body;
    if (!Array.isArray(commands)) {
        return res.status(400).json({ error: "Expected JSON array of commands" });
    }
    try {
        const results = [];
        for (const args of commands) {
            try {
                const result = await executeRedisCommand(args);
                results.push({ result });
            } catch (err) {
                results.push({ error: err.message });
            }
        }
        res.json(results);
    } catch (err) {
        console.error("[upstash] Pipeline error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// URL-based format: POST /<command>/<key>[/<args...>] (used by some callers)
upstashApp.post("/:command/:key?/*", async (req, res) => {
    const { command, key } = req.params;
    const extraArgs = req.params[0] ? req.params[0].split("/") : [];

    // For hset with object body, convert to pairs
    if (command.toLowerCase() === "hset" && req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
        const pairs = Object.entries(req.body).flat();
        try {
            const result = await executeRedisCommand(["hset", key, ...pairs]);
            return res.json({ result });
        } catch (err) {
            console.error(`[upstash] Error executing ${command}:`, err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    const args = [command, key, ...extraArgs].filter(Boolean);
    try {
        const result = await executeRedisCommand(args);
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

// ─── Admin UI ─────────────────────────────────────────────────────────────
edgeConfigApp.get("/_admin/edge_config/edit", (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html><head>
<title>Edge Config - Local Dev</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 16px; color: #fff; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
  button { background: #262626; border: 1px solid #404040; color: #e5e5e5; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  button:hover { background: #333; }
  .key-list { display: flex; flex-direction: column; gap: 8px; }
  .key-item { background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 12px 16px; }
  .key-name { font-weight: 600; color: #60a5fa; font-size: 14px; margin-bottom: 6px; cursor: pointer; }
  .key-value { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; color: #a3a3a3; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
  .key-value.editing { background: #1a1a2e; border: 1px solid #404080; border-radius: 4px; padding: 8px; color: #e5e5e5; outline: none; width: 100%; min-height: 60px; resize: vertical; }
  .key-actions { margin-top: 8px; display: none; gap: 6px; }
  .key-item.editing .key-actions { display: flex; }
  .save-btn { background: #1d4ed8; border-color: #2563eb; }
  .save-btn:hover { background: #2563eb; }
  .cancel-btn { background: #7f1d1d; border-color: #991b1b; }
  .type-tag { font-size: 11px; color: #737373; margin-left: 8px; font-weight: normal; }
  .status { color: #4ade80; font-size: 13px; margin-left: 12px; opacity: 0; transition: opacity 0.3s; }
  .status.show { opacity: 1; }
</style>
</head><body>
<div style="display:flex;align-items:center;">
  <h1>Edge Config</h1>
  <span class="status" id="status"></span>
</div>
<div class="toolbar">
  <button onclick="reload()">Reload from file</button>
  <button onclick="location.reload()">Refresh</button>
</div>
<div class="key-list" id="keys"></div>
<script>
  let data = {};
  async function load() {
    const res = await fetch('/items');
    const json = await res.json();
    data = json.items || json;
    render();
  }
  function render() {
    const el = document.getElementById('keys');
    el.innerHTML = Object.entries(data).sort(([a],[b]) => a.localeCompare(b)).map(([key, value]) => {
      const type = Array.isArray(value) ? 'array' : typeof value;
      const display = JSON.stringify(value, null, 2);
      return '<div class="key-item" id="item-'+key+'">'+
        '<div class="key-name" onclick="edit(\\''+key+'\\')">'+key+'<span class="type-tag">'+type+'</span></div>'+
        '<div class="key-value" id="val-'+key+'">'+escHtml(display)+'</div>'+
        '<div class="key-actions" id="actions-'+key+'">'+
          '<button class="save-btn" onclick="save(\\''+key+'\\')">Save</button>'+
          '<button class="cancel-btn" onclick="cancel(\\''+key+'\\')">Cancel</button>'+
        '</div></div>';
    }).join('');
  }
  function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function edit(key) {
    const item = document.getElementById('item-'+key);
    if (item.classList.contains('editing')) return;
    item.classList.add('editing');
    const valEl = document.getElementById('val-'+key);
    const cur = JSON.stringify(data[key], null, 2);
    valEl.outerHTML = '<textarea class="key-value editing" id="val-'+key+'">'+escHtml(cur)+'</textarea>';
  }
  function cancel(key) {
    document.getElementById('item-'+key).classList.remove('editing');
    const valEl = document.getElementById('val-'+key);
    valEl.outerHTML = '<div class="key-value" id="val-'+key+'">'+escHtml(JSON.stringify(data[key], null, 2))+'</div>';
  }
  async function save(key) {
    const valEl = document.getElementById('val-'+key);
    try {
      const newVal = JSON.parse(valEl.value);
      await fetch('/items', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({items:[{operation:'upsert',key,value:newVal}]}) });
      data[key] = newVal;
      cancel(key);
      flash('Saved '+key);
    } catch(e) { alert('Invalid JSON: '+e.message); }
  }
  async function reload() {
    await fetch('/reload', {method:'POST'});
    await load();
    flash('Reloaded from file');
  }
  function flash(msg) {
    const s = document.getElementById('status');
    s.textContent = msg;
    s.classList.add('show');
    setTimeout(() => s.classList.remove('show'), 2000);
  }
  load();
</script>
</body></html>`);
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
