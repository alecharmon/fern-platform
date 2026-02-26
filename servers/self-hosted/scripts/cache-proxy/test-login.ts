/**
 * Test login endpoint for validating basic_token_verification auth
 * without needing a real auth provider.
 *
 * When FERN_AUTH_TEST_LOGIN=true, this provides a mock login page:
 *
 * Flow:
 * 1. User visits docs -> middleware sees no fern_token -> redirects to FERN_AUTH_REDIRECT
 * 2. Set FERN_AUTH_REDIRECT to http://<host>/__test-login
 * 3. User sees "Login with Test" button -> clicks it
 * 4. Proxy mints a valid JWT, sets fern_token cookie, redirects back to docs
 */

import { API_KEY_INJECTION_ENABLED, BASE_PATH, FERN_AUTH_SECRET, PROXY_PORT, TEST_LOGIN_ENABLED } from "./config";
import { mintJWT } from "./jwt-utils";
import { log } from "./logger";

function buildTestFernPayload(): Record<string, unknown> {
    if (!API_KEY_INJECTION_ENABLED) {
        return {};
    }

    const rand = () => Math.random().toString(36).slice(2, 10);
    return {
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

async function mintTestFernJWT(): Promise<string> {
    const token = await mintJWT({
        fernPayload: buildTestFernPayload(),
        expiresInSeconds: 30 * 24 * 60 * 60,
        secret: FERN_AUTH_SECRET
    });
    if (!token) {
        throw new Error("Failed to mint test JWT: no secret configured");
    }
    return token;
}

function fixLocalhostProtocol(url: string): string {
    if (typeof url === "string" && url.startsWith("https://localhost")) {
        return "http" + url.slice(5);
    }
    return url;
}

function serveTestLoginPage(req: Request): Response {
    const url = new URL(req.url);
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const state = url.searchParams.get("state") || "/";

    const html =
        "<!DOCTYPE html>\n" +
        '<html lang="en">\n' +
        "<head>\n" +
        '    <meta charset="UTF-8">\n' +
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        "    <title>Test Login - Fern Docs</title>\n" +
        "    <style>\n" +
        "        * { margin: 0; padding: 0; box-sizing: border-box; }\n" +
        "        body {\n" +
        "            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n" +
        "            min-height: 100vh;\n" +
        "            display: flex;\n" +
        "            align-items: center;\n" +
        "            justify-content: center;\n" +
        "            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);\n" +
        "            color: #e2e8f0;\n" +
        "        }\n" +
        "        .card {\n" +
        "            background: #1e293b;\n" +
        "            border: 1px solid #334155;\n" +
        "            border-radius: 12px;\n" +
        "            padding: 40px;\n" +
        "            max-width: 420px;\n" +
        "            width: 90%;\n" +
        "            text-align: center;\n" +
        "            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);\n" +
        "        }\n" +
        "        .logo { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #f8fafc; }\n" +
        "        .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }\n" +
        "        .info {\n" +
        "            background: #0f172a;\n" +
        "            border: 1px solid #334155;\n" +
        "            border-radius: 8px;\n" +
        "            padding: 16px;\n" +
        "            margin-bottom: 24px;\n" +
        "            text-align: left;\n" +
        "            font-size: 13px;\n" +
        "            color: #94a3b8;\n" +
        "            line-height: 1.5;\n" +
        "        }\n" +
        "        .info code {\n" +
        "            background: #334155;\n" +
        "            padding: 2px 6px;\n" +
        "            border-radius: 4px;\n" +
        "            font-family: 'SF Mono', Consolas, monospace;\n" +
        "            font-size: 12px;\n" +
        "            color: #e2e8f0;\n" +
        "        }\n" +
        "        .badge {\n" +
        "            display: inline-block;\n" +
        "            background: #f59e0b20;\n" +
        "            color: #f59e0b;\n" +
        "            border: 1px solid #f59e0b40;\n" +
        "            padding: 4px 12px;\n" +
        "            border-radius: 20px;\n" +
        "            font-size: 12px;\n" +
        "            font-weight: 600;\n" +
        "            margin-bottom: 24px;\n" +
        "            letter-spacing: 0.5px;\n" +
        "        }\n" +
        "        .button-group { display: flex; gap: 16px; width: 100%; }\n" +
        "        .button-group form { flex: 1; }\n" +
        "        button {\n" +
        "            width: 100%;\n" +
        "            padding: 14px 24px;\n" +
        "            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);\n" +
        "            color: white;\n" +
        "            border: none;\n" +
        "            border-radius: 8px;\n" +
        "            font-size: 16px;\n" +
        "            font-weight: 600;\n" +
        "            cursor: pointer;\n" +
        "            transition: all 0.2s;\n" +
        "        }\n" +
        "        button.btn-secondary { background: linear-gradient(135deg, #059669 0%, #10b981 100%); }\n" +
        "        button:hover { transform: translateY(-1px); box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.4); }\n" +
        "        button.btn-secondary:hover { box-shadow: 0 8px 25px -5px rgba(5, 150, 105, 0.4); }\n" +
        "        button:active { transform: translateY(0); }\n" +
        "        .method-label { margin-top: 8px; font-size: 11px; color: #64748b; text-align: center; }\n" +
        "        .return-to { margin-top: 16px; font-size: 12px; color: #64748b; word-break: break-all; }\n" +
        "    </style>\n" +
        "</head>\n" +
        "<body>\n" +
        '    <div class="card">\n' +
        '        <div class="logo">Fern Docs</div>\n' +
        '        <div class="subtitle">Self-Hosted Authentication Test</div>\n' +
        '        <div class="badge">TEST MODE</div>\n' +
        '        <div class="info">\n' +
        '            This is a <strong style="color: #e2e8f0;">test login page</strong> for validating\n' +
        "            <code>basic_token_verification</code> auth in the self-hosted container.\n" +
        "            Choose a login method below to mint a valid JWT and redirect through\n" +
        "            the <code>/api/fern-docs/auth/jwt/callback</code> route.\n" +
        "        </div>\n" +
        '        <div class="button-group">\n' +
        '            <form method="POST" action="/__test-login">\n' +
        '                <input type="hidden" name="redirect_uri" value="' +
        redirectUri.replace(/"/g, "&quot;") +
        '" />\n' +
        '                <input type="hidden" name="state" value="' +
        state.replace(/"/g, "&quot;") +
        '" />\n' +
        '                <input type="hidden" name="action" value="get" />\n' +
        '                <button type="submit">Login via GET</button>\n' +
        '                <div class="method-label">Token in URL query params</div>\n' +
        "            </form>\n" +
        '            <form method="POST" action="/__test-login">\n' +
        '                <input type="hidden" name="redirect_uri" value="' +
        redirectUri.replace(/"/g, "&quot;") +
        '" />\n' +
        '                <input type="hidden" name="state" value="' +
        state.replace(/"/g, "&quot;") +
        '" />\n' +
        '                <input type="hidden" name="action" value="post" />\n' +
        '                <button type="submit" class="btn-secondary">Login via POST</button>\n' +
        '                <div class="method-label">Token in form body</div>\n' +
        "            </form>\n" +
        "        </div>\n" +
        '        <div class="return-to">Redirecting to: ' +
        state.replace(/</g, "&lt;").replace(/>/g, "&gt;") +
        "</div>\n" +
        "    </div>\n" +
        "</body>\n" +
        "</html>";

    return new Response(html, {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
}

async function handleTestLoginPost(req: Request): Promise<Response> {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const action = params.get("action") || "get";
    const redirectUri = fixLocalhostProtocol(decodeURIComponent(params.get("redirect_uri") || ""));
    const state = fixLocalhostProtocol(decodeURIComponent(params.get("state") || "/"));

    if (!FERN_AUTH_SECRET) {
        log("Test login error: FERN_AUTH_SECRET is not set");
        return new Response("FERN_AUTH_SECRET is required for test login", {
            status: 500,
            headers: { "Content-Type": "text/plain" }
        });
    }

    const token = await mintTestFernJWT();
    log("Test login: minted JWT, action=" + action + ", redirecting to " + state);

    const defaultCallbackPath = `${BASE_PATH}/api/fern-docs/auth/jwt/callback`;

    if (action === "post") {
        const callbackUrl = redirectUri || defaultCallbackPath;
        const html =
            "<!DOCTYPE html>\n" +
            "<html><head><title>Redirecting...</title></head>\n" +
            "<body>\n" +
            '    <form id="cb" method="POST" action="' +
            callbackUrl.replace(/"/g, "&quot;") +
            '">\n' +
            '        <input type="hidden" name="fern_token" value="' +
            token.replace(/"/g, "&quot;") +
            '" />\n' +
            '        <input type="hidden" name="state" value="' +
            state.replace(/"/g, "&quot;") +
            '" />\n' +
            "    </form>\n" +
            '    <script>document.getElementById("cb").submit();</script>\n' +
            "</body></html>";
        return new Response(html, {
            status: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store"
            }
        });
    }

    const callbackUrl = new URL(redirectUri || defaultCallbackPath, "http://localhost:" + PROXY_PORT);
    callbackUrl.searchParams.set("fern_token", token);
    callbackUrl.searchParams.set("state", state);
    return new Response(null, {
        status: 302,
        headers: {
            Location: callbackUrl.toString(),
            "Cache-Control": "no-store"
        }
    });
}

export async function handleTestLogin(req: Request): Promise<Response | null> {
    if (!TEST_LOGIN_ENABLED) {
        return null;
    }

    const url = new URL(req.url);
    if (url.pathname !== "/__test-login") {
        return null;
    }

    if (req.method === "GET") {
        return serveTestLoginPage(req);
    }

    if (req.method === "POST") {
        return handleTestLoginPost(req);
    }

    return new Response("Method not allowed", {
        status: 405,
        headers: { "Content-Type": "text/plain" }
    });
}
