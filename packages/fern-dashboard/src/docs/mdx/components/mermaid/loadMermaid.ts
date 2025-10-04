import type { Mermaid } from "mermaid";

let mermaidPromise: Promise<Mermaid> | null = null;

const MERMAID_LOCATION = "https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.min.js";

export function loadMermaid(): Promise<Mermaid> {
    if (mermaidPromise) return mermaidPromise;

    mermaidPromise = new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
            reject(new Error("Mermaid can only be loaded in browser"));
            return;
        }

        const script = document.createElement("script");
        script.src = MERMAID_LOCATION;

        script.onload = () => {
            resolve((window as any).mermaid as Mermaid);
        };

        script.onerror = () => reject(new Error("Failed to load Mermaid"));
        document.head.appendChild(script);
    });

    return mermaidPromise;
}
