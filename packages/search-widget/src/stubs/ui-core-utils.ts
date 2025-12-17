/**
 * Stub replacement for @fern-api/ui-core-utils in standalone bundle.
 */

export function getDevice(): "desktop" | "mobile" {
    if (typeof window === "undefined") {
        return "desktop";
    }
    return window.innerWidth < 768 ? "mobile" : "desktop";
}

export function getPlatform(): "mac" | "windows" | "linux" | "other" {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return "other";
    }
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf("mac") !== -1) {
        return "mac";
    }
    if (userAgent.indexOf("win") !== -1) {
        return "windows";
    }
    if (userAgent.indexOf("linux") !== -1) {
        return "linux";
    }
    return "other";
}

export function isNonNullish<T>(value: T | null | undefined): value is T {
    return value != null;
}

export const EMPTY_OBJECT = Object.freeze({});

export function withDefaultProtocol(url: string): string {
    if (!url) {
        return url;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }
    return "https://" + url;
}

export function formatUtc(date: Date | string | number): string {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    return d.toISOString();
}

export function assertNever(value: never): never {
    throw new Error(`Unexpected value: ${value}`);
}
