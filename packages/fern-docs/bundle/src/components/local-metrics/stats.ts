import type { StatsSummary } from "./types";

/**
 * Calculate basic statistics from an array of samples.
 */
export function calculateStats(samples: number[]): StatsSummary {
    if (samples.length === 0) {
        return {
            count: 0,
            min: 0,
            max: 0,
            avg: 0
        };
    }

    const count = samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const sum = samples.reduce((a, b) => a + b, 0);
    const avg = sum / count;

    return {
        count,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        avg: Math.round(avg * 100) / 100
    };
}
