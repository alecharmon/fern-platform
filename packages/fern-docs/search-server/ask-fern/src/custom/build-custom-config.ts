import { CustomAskFernConfig } from "./types";

export function buildCustomConfig(url: string): CustomAskFernConfig {
    return {
        isCohere: url.includes("cohere")
    };
}
