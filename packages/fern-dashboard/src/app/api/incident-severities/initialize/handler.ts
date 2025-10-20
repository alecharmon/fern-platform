import createSeverity from "../create/handler";
import listSeverities from "../list/handler";

const DEFAULT_SEVERITIES = [
    {
        name: "Critical",
        description: "Critical incidents requiring immediate attention and response",
        rank: 1
    },
    {
        name: "Major",
        description: "Major incidents with significant impact on operations",
        rank: 2
    },
    {
        name: "Minor",
        description: "Minor incidents with limited impact",
        rank: 3
    }
];

export default async function initializeSeverities() {
    try {
        // First, fetch existing severities
        const existingResult = await listSeverities();

        if (!existingResult.success) {
            throw new Error("Failed to fetch existing severities");
        }

        const existingSeverities = existingResult.severities;
        const createdSeverities = [];
        const skippedSeverities = [];

        // Create only the severities that don't exist
        for (const defaultSeverity of DEFAULT_SEVERITIES) {
            const exists = existingSeverities.some((s) => s.name.toLowerCase() === defaultSeverity.name.toLowerCase());

            if (exists) {
                const existing = existingSeverities.find(
                    (s) => s.name.toLowerCase() === defaultSeverity.name.toLowerCase()
                );
                skippedSeverities.push({
                    ...existing,
                    reason: "already exists"
                });
            } else {
                try {
                    const result = await createSeverity(defaultSeverity);
                    if (result.success && result.severity) {
                        createdSeverities.push(result.severity);
                    }
                } catch (error) {
                    // If creation fails, log it but continue with others
                    console.error(`Failed to create severity ${defaultSeverity.name}:`, error);
                }
            }
        }

        return {
            success: true,
            created: createdSeverities,
            skipped: skippedSeverities,
            total: existingSeverities.length + createdSeverities.length
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Unknown error occurred while initializing severities");
    }
}
