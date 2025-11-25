import { getEdge } from "./getEdge";

export interface PageStatsJobConfig {
    pageUrls: string[];
}

export async function getPageStatsJobConfig(): Promise<PageStatsJobConfig | undefined> {
    return getEdge<PageStatsJobConfig>("pageStatsJob");
}
