import { z } from "zod";

export const CreateSeverityRequestSchema = z.object({
    name: z.string(),
    description: z.string(),
    rank: z.number()
});

export type CreateSeverityRequest = z.infer<typeof CreateSeverityRequestSchema>;

interface Severity {
    id: string;
    name: string;
    description: string;
    rank: number;
}

interface IncidentIoSeverityResponse {
    severity: Severity;
}

export default async function createSeverity(body: CreateSeverityRequest) {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const incidentIoApiKey = process.env.INCIDENT_IO_API_KEY;

    if (!incidentIoApiKey) {
        throw new Error("INCIDENT_IO_API_KEY environment variable is not configured");
    }

    // Validate required fields
    if (!body.name) {
        throw new Error("Severity name is required");
    }

    if (!body.description) {
        throw new Error("Severity description is required");
    }

    if (body.rank === undefined || body.rank === null) {
        throw new Error("Severity rank is required");
    }

    try {
        const response = await fetch("https://api.incident.io/v1/severities", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${incidentIoApiKey}`
            },
            body: JSON.stringify({
                name: body.name,
                description: body.description,
                rank: body.rank
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `incident.io API error: ${response.status} ${response.statusText}`;

            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage = errorJson.error.message;
                } else if (errorJson.message) {
                    errorMessage = errorJson.message;
                }
            } catch {
                if (errorText) {
                    errorMessage = `${errorMessage} - ${errorText}`;
                }
            }

            throw new Error(errorMessage);
        }

        const result = (await response.json()) as IncidentIoSeverityResponse;

        return {
            success: true,
            severity: {
                id: result.severity.id,
                name: result.severity.name,
                description: result.severity.description,
                rank: result.severity.rank
            }
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Unknown error occurred while creating severity");
    }
}
