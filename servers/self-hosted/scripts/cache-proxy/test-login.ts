/**
 * Test login endpoint for validating basic_token_verification auth
 * without needing a real auth provider.
 *
 * When FERN_AUTH_TEST_LOGIN=true, this provides a mock login page:
 *
 * Flow:
 * 1. User visits docs → middleware sees no fern_token → redirects to FERN_AUTH_REDIRECT
 * 2. Set FERN_AUTH_REDIRECT to http://<host>/__test-login
 * 3. User sees "Login with Test" button → clicks it
 * 4. Proxy mints a valid JWT, sets fern_token cookie, redirects back to docs
 */

import crypto from "crypto";
import type http from "http";
import { URL } from "url";
import {
    API_KEY_INJECTION_ENABLED,
    FERN_AUTH_ISSUER,
    FERN_AUTH_SECRET,
    PROXY_PORT,
    TEST_LOGIN_ENABLED
} from "./config";
import { log } from "./logger";

/**
 * Create a base64url-encoded string from a Buffer or string.
 */
function base64url(input: Buffer | string): string {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
    return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Mint a Fern JWT compatible with basic_token_verification.
 * Uses HMAC-SHA256 (HS256) matching the jose library's signFernJWT.
 */
function mintTestFernJWT(secret: string, issuer: string): string {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);

    const rand = () => Math.random().toString(36).slice(2, 10);
    let fernPayload: Record<string, unknown> = {};
    if (API_KEY_INJECTION_ENABLED) {
        fernPayload = {
            playground: {
                initial_state: {
                    auth: {
                        bearer_token: "test-bearer-" + rand()
                    }
                },
                env_state: {
                    prod: {
                        auth: {
                            bearer_token: JSON.stringify([
                                { "application 1": "key-" + rand() },
                                { "application 2": "key-" + rand() }
                            ])
                        }
                    },
                    dev: {
                        auth: {
                            bearer_token: JSON.stringify([
                                { foo: "bar-" + rand() },
                                { biz: "bazz-" + rand() },
                                { buzz: "bee-" + rand() }
                            ])
                        }
                    }
                }
            }
        };
    }

    const payload = {
        fern: fernPayload,
        iat: now,
        exp: now + 30 * 24 * 60 * 60, // 30 days
        iss: issuer || "https://buildwithfern.com"
    };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = crypto.createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest();
    const signatureB64 = base64url(signature);

    return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Fix protocol for localhost URLs: https://localhost → http://localhost.
 * The middleware may incorrectly produce https:// for localhost when the host
 * contains URL-encoded characters (e.g. localhost%3A3000).
 */
function fixLocalhostProtocol(url: string): string {
    if (typeof url === "string" && url.startsWith("https://localhost")) {
        return "http" + url.slice(5);
    }
    return url;
}

/**
 * Serve the test login HTML page.
 *
 * The middleware redirects here with query params:
 *   - redirect_uri: the /api/fern-docs/auth/jwt/callback URL
 *   - state: the URL the user was trying to visit
 *
 * On click, we mint a JWT and redirect to the real callback route,
 * which verifies the token and sets the fern_token cookie properly.
 */
function serveTestLoginPage(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || "", `http://localhost:${PROXY_PORT}`);
    // The middleware sets these when redirecting to the login page
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const state = url.searchParams.get("state") || "/";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Login - Fern Docs</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #e2e8f0;
        }
        .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 40px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .logo {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #f8fafc;
        }
        .subtitle {
            color: #94a3b8;
            font-size: 14px;
            margin-bottom: 32px;
        }
        .info {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: left;
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.5;
        }
        .info code {
            background: #334155;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Consolas, monospace;
            font-size: 12px;
            color: #e2e8f0;
        }
        .badge {
            display: inline-block;
            background: #f59e0b20;
            color: #f59e0b;
            border: 1px solid #f59e0b40;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 24px;
            letter-spacing: 0.5px;
        }
        .button-group { display: flex; gap: 16px; width: 100%; }
        .button-group form { flex: 1; }
        button {
            width: 100%;
            padding: 14px 24px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        button.btn-secondary {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
        }
        button:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.4);
        }
        button.btn-secondary:hover {
            box-shadow: 0 8px 25px -5px rgba(5, 150, 105, 0.4);
        }
        button:active {
            transform: translateY(0);
        }
        .method-label {
            margin-top: 8px;
            font-size: 11px;
            color: #64748b;
            text-align: center;
        }
        .return-to {
            margin-top: 16px;
            font-size: 12px;
            color: #64748b;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">Fern Docs</div>
        <div class="subtitle">Self-Hosted Authentication Test</div>
        <div class="badge">TEST MODE</div>
        <div class="info">
            This is a <strong style="color: #e2e8f0;">test login page</strong> for validating
            <code>basic_token_verification</code> auth in the self-hosted container.
            Choose a login method below to mint a valid JWT and redirect through
            the <code>/api/fern-docs/auth/jwt/callback</code> route.
        </div>
        <div class="button-group">
            <form method="POST" action="/__test-login">
                <input type="hidden" name="redirect_uri" value="${redirectUri.replace(/"/g, "&quot;")}" />
                <input type="hidden" name="state" value="${state.replace(/"/g, "&quot;")}" />
                <input type="hidden" name="action" value="get" />
                <button type="submit">Login via GET</button>
                <div class="method-label">Token in URL query params</div>
            </form>
            <form method="POST" action="/__test-login">
                <input type="hidden" name="redirect_uri" value="${redirectUri.replace(/"/g, "&quot;")}" />
                <input type="hidden" name="state" value="${state.replace(/"/g, "&quot;")}" />
                <input type="hidden" name="action" value="post" />
                <button type="submit" class="btn-secondary">Login via POST</button>
                <div class="method-label">Token in form body</div>
            </form>
        </div>
        <div class="return-to">Redirecting to: ${state.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    </div>
</body>
</html>`;

    res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
    });
    res.end(html);
}

/**
 * Handle POST to /__test-login: mint JWT and redirect through the real callback.
 *
 * Supports two actions via the "action" form field:
 *   - "get": redirects to the callback with fern_token and state as query params
 *   - "post": returns an auto-submitting form that POSTs fern_token and state
 *             to the callback as application/x-www-form-urlencoded
 */
function handleTestLoginPost(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = "";
    req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
    });
    req.on("end", () => {
        const params = new URLSearchParams(body);
        const action = params.get("action") || "get";
        const redirectUri = fixLocalhostProtocol(decodeURIComponent(params.get("redirect_uri") || ""));
        const state = fixLocalhostProtocol(decodeURIComponent(params.get("state") || "/"));

        if (!FERN_AUTH_SECRET) {
            log("Test login error: FERN_AUTH_SECRET is not set");
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("FERN_AUTH_SECRET is required for test login");
            return;
        }

        const token = mintTestFernJWT(FERN_AUTH_SECRET, FERN_AUTH_ISSUER);
        log(`Test login: minted JWT (issuer=${FERN_AUTH_ISSUER}), action=${action}, redirecting to ${state}`);

        if (action === "post") {
            const callbackUrl = redirectUri || "/api/fern-docs/auth/jwt/callback";
            const html = `<!DOCTYPE html>
<html><head><title>Redirecting...</title></head>
<body>
    <form id="cb" method="POST" action="${callbackUrl.replace(/"/g, "&quot;")}">
        <input type="hidden" name="fern_token" value="${token.replace(/"/g, "&quot;")}" />
        <input type="hidden" name="state" value="${state.replace(/"/g, "&quot;")}" />
    </form>
    <script>document.getElementById("cb").submit();</script>
</body></html>`;
            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store"
            });
            res.end(html);
            return;
        }

        // Default: GET flow — redirect to callback with query params
        const callbackUrl = new URL(
            redirectUri || "/api/fern-docs/auth/jwt/callback",
            `http://localhost:${PROXY_PORT}`
        );
        callbackUrl.searchParams.set("fern_token", token);
        callbackUrl.searchParams.set("state", state);
        res.writeHead(302, {
            Location: callbackUrl.toString(),
            "Cache-Control": "no-store"
        });
        res.end();
    });
}

/**
 * Handle the test login endpoint (GET shows page, POST mints token).
 * Returns true if the request was handled, false otherwise.
 */
export function handleTestLogin(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (!TEST_LOGIN_ENABLED) {
        return false;
    }

    const url = new URL(req.url || "", `http://localhost:${PROXY_PORT}`);
    if (url.pathname !== "/__test-login") {
        return false;
    }

    if (req.method === "GET") {
        serveTestLoginPage(req, res);
        return true;
    }

    if (req.method === "POST") {
        handleTestLoginPost(req, res);
        return true;
    }

    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
    return true;
}
