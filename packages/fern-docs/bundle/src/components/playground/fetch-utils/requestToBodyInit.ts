import { UnreachableCaseError } from "ts-essentials";

import type { ProxyRequest } from "../types/proxy";

export async function toBodyInit(body: ProxyRequest["body"], contentType?: string): Promise<BodyInit | null> {
    if (body == null) {
        return null;
    }

    if (contentType?.toLowerCase().includes("form-urlencoded")) {
        return toUrlSearchParams(body);
    }

    switch (body.type) {
        case "json":
            return JSON.stringify(body.value);
        case "form-data": {
            const formData = new FormData();
            for (const [key, value] of Object.entries(body.value)) {
                switch (value.type) {
                    case "json": {
                        if (value.value === undefined) {
                            break;
                        }
                        const finalValue = typeof value.value === "string" ? value.value : JSON.stringify(value.value);

                        formData.append(key, finalValue);
                        break;
                    }
                    case "file":
                        if (value.value?.dataUrl != null) {
                            const response = await fetch(value.value.dataUrl);
                            const blob = await response.blob();
                            formData.append(key, blob, value.value.name);
                        }
                        break;
                    case "fileArray":
                        for (const file of value.value) {
                            if (file?.dataUrl != null) {
                                const response = await fetch(file.dataUrl);
                                const blob = await response.blob();
                                formData.append(key, blob, file.name);
                            }
                        }
                        break;
                    case "exploded":
                        for (const item of value.value) {
                            if (item === undefined) {
                                continue;
                            }
                            const finalValue = typeof item === "string" ? item : JSON.stringify(item);

                            formData.append(key, finalValue);
                        }
                        break;
                    default:
                        console.error(new UnreachableCaseError(value));
                        break;
                }
            }
            return formData;
        }
        case "octet-stream": {
            if (body.value?.dataUrl == null) {
                return null;
            }
            const blob = new Blob([body.value.dataUrl], {
                type: body.value?.type
            });
            return blob;
        }
        default:
            console.error(new UnreachableCaseError(body));
            return null;
    }
}

function toUrlSearchParams(body: NonNullable<ProxyRequest["body"]>): string | null {
    const params = new URLSearchParams();

    switch (body.type) {
        case "json": {
            if (body.value == null || typeof body.value !== "object") {
                return null;
            }
            for (const [key, value] of Object.entries(body.value as Record<string, unknown>)) {
                if (value !== undefined) {
                    params.append(key, String(value));
                }
            }
            return params.toString();
        }
        case "form-data": {
            for (const [key, value] of Object.entries(body.value)) {
                switch (value.type) {
                    case "json":
                        if (value.value !== undefined) {
                            params.append(
                                key,
                                typeof value.value === "string" ? value.value : JSON.stringify(value.value)
                            );
                        }
                        break;
                    case "exploded":
                        for (const item of value.value) {
                            if (item !== undefined) {
                                params.append(key, typeof item === "string" ? item : JSON.stringify(item));
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
            return params.toString();
        }
        default:
            return null;
    }
}
