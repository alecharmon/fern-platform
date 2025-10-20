interface Severity {
    id: string;
    name: string;
    description: string;
    rank: number;
}

interface IncidentIoSeveritiesResponse {
    severities: Severity[];
}

export default async function listSeverities() {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const incidentIoApiKey = process.env.INCIDENT_IO_API_KEY;

    if (!incidentIoApiKey) {
        throw new Error("INCIDENT_IO_API_KEY environment variable is not configured");
    }

    try {
        const response = await fetch("https://api.incident.io/v1/severities", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${incidentIoApiKey}`
            }
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

        const result = (await response.json()) as IncidentIoSeveritiesResponse;

        return {
            success: true,
            severities: result.severities.map((severity) => ({
                id: severity.id,
                name: severity.name,
                description: severity.description,
                rank: severity.rank
            }))
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Unknown error occurred while fetching severities");
    }
}
