"use client";

import { useEffect, useState } from "react";

// import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

// export declare namespace CreateIncidentPage {
//     export interface Props {
//         session: Auth0SessionData;
//     }
// }

interface Severity {
    id: string;
    name: string;
    description: string;
    rank: number;
}

interface CreateIncidentForm {
    name: string;
    summary: string;
    severityId: string;
    visibility: "public";
}

export function CreateIncidentPage() {
    const [form, setForm] = useState<CreateIncidentForm>({
        name: "",
        summary: "",
        severityId: "",
        visibility: "public"
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ reference: string; url: string } | null>(null);
    const [severities, setSeverities] = useState<Severity[]>([]);
    const [loadingSeverities, setLoadingSeverities] = useState(true);
    const [initializingSeverities, setInitializingSeverities] = useState(false);

    // Fetch severities on mount
    useEffect(() => {
        const fetchSeverities = async () => {
            try {
                const response = await fetch("/api/incident-severities/list");
                const result = await response.json();

                if (result.success && result.severities) {
                    // Sort by rank
                    const sortedSeverities = result.severities.sort((a: Severity, b: Severity) => a.rank - b.rank);
                    setSeverities(sortedSeverities);
                }
            } catch (err) {
                console.error("Failed to fetch severities:", err);
            } finally {
                setLoadingSeverities(false);
            }
        };

        void fetchSeverities();
    }, []);

    const handleInitializeSeverities = async () => {
        setInitializingSeverities(true);
        try {
            const response = await fetch("/api/incident-severities/initialize", {
                method: "POST"
            });
            const result = await response.json();

            if (result.success) {
                // Refresh severities list
                const listResponse = await fetch("/api/incident-severities/list");
                const listResult = await listResponse.json();

                if (listResult.success && listResult.severities) {
                    const sortedSeverities = listResult.severities.sort((a: Severity, b: Severity) => a.rank - b.rank);
                    setSeverities(sortedSeverities);
                }
            }
        } catch (err) {
            console.error("Failed to initialize severities:", err);
        } finally {
            setInitializingSeverities(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsSubmitting(true);

        try {
            // Generate a unique idempotency key
            const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

            const response = await fetch("/api/page-fern", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: form.name,
                    idempotencyKey,
                    severityId: form.severityId || undefined,
                    visibility: "public",
                    summary: form.summary || undefined
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Failed to create incident");
            }

            setSuccess({
                reference: result.incident.reference,
                url: result.incident.permalinkUrl
            });

            // Reset form
            setForm({
                name: "",
                summary: "",
                severityId: "",
                visibility: "public"
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputChange =
        (field: keyof CreateIncidentForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            setForm((prev) => ({ ...prev, [field]: e.target.value }));
        };

    return (
        <div className="flex flex-1 flex-col items-center gap-4">
            <h1 className="mx-auto mt-6 w-full max-w-[750px] text-2xl font-bold sm:mt-8 md:mt-10">Create Incident</h1>

            <div className="mx-auto w-full max-w-[750px] text-gray-900">
                Create a new incident in incident.io to track and manage issues.
            </div>

            {success && (
                <div className="mx-auto w-full max-w-[750px] rounded-xl border border-green-600 bg-green-50 p-4">
                    <div className="font-bold text-green-800">Incident created successfully!</div>
                    <div className="mt-2 text-green-800">
                        Reference: <span className="font-mono font-semibold">{success.reference}</span>
                    </div>
                    {success.url && (
                        <a
                            href={success.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-green-800 underline hover:text-green-900"
                        >
                            View incident →
                        </a>
                    )}
                </div>
            )}

            {error && (
                <div className="mx-auto w-full max-w-[750px] rounded-xl border border-red-600 bg-red-50 p-4">
                    <div className="font-bold text-red-900">Error</div>
                    <div className="mt-1 text-red-800">{error}</div>
                </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto w-full max-w-[750px] space-y-4">
                <div className="rounded-xl border border-border bg-gray-100 p-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="mb-2 block text-sm font-semibold text-gray-1100">
                                Incident Name *
                            </label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="e.g., API Outage on Production"
                                value={form.name}
                                onChange={handleInputChange("name")}
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label htmlFor="summary" className="mb-2 block text-sm font-semibold text-gray-1100">
                                Summary
                            </label>
                            <textarea
                                id="summary"
                                placeholder="Provide a brief description of the incident..."
                                value={form.summary}
                                onChange={handleInputChange("summary")}
                                disabled={isSubmitting}
                                rows={4}
                                className="file:text-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input shadow-xs flex w-full min-w-0 rounded-md border bg-white px-3 py-2 text-base outline-none transition-[color,box-shadow] placeholder:text-gray-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="severityId" className="mb-2 block text-sm font-semibold text-gray-1100">
                                Severity
                            </label>
                            {loadingSeverities ? (
                                <div className="text-sm text-gray-800">Loading severities...</div>
                            ) : severities.length > 0 ? (
                                <select
                                    id="severityId"
                                    value={form.severityId}
                                    onChange={handleInputChange("severityId")}
                                    disabled={isSubmitting}
                                    className="file:text-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input shadow-xs flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] sm:text-sm"
                                >
                                    <option value="">Select a severity (optional)</option>
                                    {severities.map((severity) => (
                                        <option key={severity.id} value={severity.id}>
                                            {severity.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="space-y-2">
                                    <div className="text-sm text-gray-800">
                                        No severities found. Initialize the default severities first.
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => void handleInitializeSeverities()}
                                        disabled={initializingSeverities}
                                        size="sm"
                                    >
                                        {initializingSeverities ? "Initializing..." : "Initialize Severities"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            setForm({
                                name: "",
                                summary: "",
                                severityId: "",
                                visibility: "public"
                            });
                            setError(null);
                            setSuccess(null);
                        }}
                        disabled={isSubmitting}
                    >
                        Clear
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !form.name}>
                        {isSubmitting ? "Creating..." : "Create Incident"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
