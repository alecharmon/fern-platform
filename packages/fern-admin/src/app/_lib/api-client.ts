"use client";

async function internalApiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        }
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new InternalApiError(response.status, response.statusText, body);
    }

    return (await response.json()) as T;
}

export class InternalApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly body: string
    ) {
        super(`Internal API request failed: ${status} ${statusText}`);
        this.name = "InternalApiError";
    }
}

export const InternalApiClient = {
    test: () => internalApiFetch<{ ok: boolean }>("/api/test")
};
