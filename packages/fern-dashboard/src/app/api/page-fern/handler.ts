interface CreateIncidentRequestBody {
    name: string;
    idempotencyKey: string;
    severityId?: string;
    visibility?: "public" | "private";
    summary?: string;
    customFieldEntries?: {
        customFieldId: string;
        values: {
            id?: string;
            value?: string;
        }[];
    }[];
    incidentTypeId?: string;
    incidentRoleAssignments?: {
        roleId: string;
        assignee: {
            id?: string;
            email?: string;
        };
    }[];
}

interface IncidentIoResponse {
    incident: {
        id: string;
        name: string;
        reference: string;
        status: string;
        severity: {
            id: string;
            name: string;
        };
        visibility: string;
        created_at: string;
        permalink_url: string;
    };
}

export default async function createIncident(body: CreateIncidentRequestBody) {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const incidentIoApiKey = process.env.INCIDENT_IO_API_KEY;

    if (!incidentIoApiKey) {
        throw new Error("INCIDENT_IO_API_KEY environment variable is not configured");
    }

    // Validate required fields
    if (!body.name) {
        throw new Error("Incident name is required");
    }

    if (!body.idempotencyKey) {
        throw new Error("Idempotency key is required");
    }

    // Construct the request payload
    const payload: Record<string, unknown> = {
        name: body.name,
        idempotency_key: body.idempotencyKey,
        visibility: body.visibility || "public"
    };

    // Add optional fields if provided
    if (body.severityId) {
        payload.severity_id = body.severityId;
    }

    if (body.summary) {
        payload.summary = body.summary;
    }

    // Handle custom field entries
    if (body.customFieldEntries) {
        payload.custom_field_entries = body.customFieldEntries.map((entry) => ({
            custom_field_id: entry.customFieldId,
            values: entry.values
        }));
    }

    if (body.incidentRoleAssignments) {
        payload.incident_role_assignments = body.incidentRoleAssignments.map((assignment) => ({
            role_id: assignment.roleId,
            assignee: assignment.assignee
        }));
    }

    if (body.incidentTypeId) {
        payload.incident_type_id = body.incidentTypeId;
    }

    try {
        const response = await fetch("https://api.incident.io/v1/incidents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${incidentIoApiKey}`
            },
            body: JSON.stringify(payload)
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
                // If error response is not JSON, use the status text
                if (errorText) {
                    errorMessage = `${errorMessage} - ${errorText}`;
                }
            }

            throw new Error(errorMessage);
        }

        const result = (await response.json()) as IncidentIoResponse;

        return {
            success: true,
            incident: {
                id: result.incident.id,
                name: result.incident.name,
                reference: result.incident.reference,
                status: result.incident.status,
                severity: result.incident.severity,
                visibility: result.incident.visibility,
                createdAt: result.incident.created_at,
                permalinkUrl: result.incident.permalink_url
            }
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Unknown error occurred while creating incident");
    }
}
