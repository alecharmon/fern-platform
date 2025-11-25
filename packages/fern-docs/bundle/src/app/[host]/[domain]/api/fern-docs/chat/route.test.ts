import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@fern-api/docs-server/env-variables", () => ({
    getChatLambdaUrl: vi.fn()
}));

vi.mock("@fern-api/docs-server/xfernhost/edge", () => ({
    getDocsDomainEdge: vi.fn()
}));

vi.mock("@fern-api/docs-loader", () => ({
    createCachedDocsLoader: vi.fn()
}));

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getChatLambdaUrl } from "@fern-api/docs-server/env-variables";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { POST } from "./route";

describe("chat route proxy", () => {
    it("streams success responses from the lambda chat endpoint", async () => {
        vi.mocked(getChatLambdaUrl).mockReturnValue("https://lambda.example.com/chat");
        vi.mocked(getDocsDomainEdge).mockReturnValue("docs.example.com");
        vi.mocked(createCachedDocsLoader).mockResolvedValue({
            getConfig: vi.fn().mockResolvedValue({
                aiChatConfig: {
                    model: "claude-3.5",
                    systemPrompt: "hello"
                }
            })
        } as any);

        const fetchMock = vi.fn().mockResolvedValue(
            new Response("ok", {
                status: 200,
                headers: {
                    "Content-Type": "text/event-stream"
                }
            })
        );
        vi.stubGlobal("fetch", fetchMock);

        const request = new NextRequest("https://docs.example.com/api/fern-docs/chat", {
            method: "POST",
            body: JSON.stringify({ message: "hi" }),
            headers: {
                "content-type": "application/json"
            }
        });

        const response = await POST(request);
        expect(fetchMock).toHaveBeenCalled();
        const [, fetchOptions] = fetchMock.mock.calls[0]!;
        expect(fetchOptions).toMatchObject({
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-fern-host": "docs.example.com"
            },
            cache: "no-store",
            signal: request.signal
        });
        const parsedBody = JSON.parse(fetchOptions.body as string);
        expect(parsedBody).toEqual({
            message: "hi",
            model: "claude-3.5",
            customerSystemPrompt: "hello"
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("text/event-stream");
        expect(await response.text()).toBe("ok");
    });

    it("returns an error when the lambda responds with non-2xx", async () => {
        vi.mocked(getChatLambdaUrl).mockReturnValue("https://lambda.example.com/chat");
        vi.mocked(getDocsDomainEdge).mockReturnValue("docs.example.com");
        vi.mocked(createCachedDocsLoader).mockResolvedValue({
            getConfig: vi.fn().mockResolvedValue({
                aiChatConfig: {}
            })
        } as any);

        const fetchMock = vi.fn().mockResolvedValue(
            new Response("error", {
                status: 502
            })
        );
        vi.stubGlobal("fetch", fetchMock);

        const request = new NextRequest("https://docs.example.com/api/fern-docs/chat", {
            method: "POST",
            body: "{}",
            headers: {
                "content-type": "application/json"
            }
        });

        const response = await POST(request);
        const [, fetchOptions] = fetchMock.mock.calls[0]!;
        expect(fetchOptions.body).toBe("{}");
        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: "Failed to fetch from chat service" });
    });
});
