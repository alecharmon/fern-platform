"use client";

import { useState } from "react";

import { GenerateTokenButton } from "./GenerateTokenButton";
import { TokenDisplay } from "./TokenDisplay";

export declare namespace ApiKeysTable {
    export interface Props {
        organizationId: string;
    }
}

export function ApiKeysTable({ organizationId }: ApiKeysTable.Props) {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateTokens = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/generate-api-token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ organizationId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to generate token");
            }

            const data = await response.json();
            setToken(data.token);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Generate an API token for npm package access.</p>
                <GenerateTokenButton onClick={handleGenerateTokens} isLoading={isLoading} />
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {token && (
                <TokenDisplay
                    title="NPM Registry Token"
                    token={token}
                    description="Use this token to authenticate with the npm registry"
                />
            )}

            {!token && !error && !isLoading && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                    <p className="text-sm text-gray-600">
                        No token generated yet. Click the button above to generate a new token.
                    </p>
                </div>
            )}
        </div>
    );
}
