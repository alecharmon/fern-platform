"use client";

import type { RegistryTokens } from "@fern-api/venus-api-sdk/api";
import { useState } from "react";

import { GenerateTokenButton } from "./GenerateTokenButton";
import { TokenDisplay } from "./TokenDisplay";

export declare namespace ApiKeysTable {
    export interface Props {
        organizationId: string;
    }
}

export function ApiKeysTable({ organizationId }: ApiKeysTable.Props) {
    const [tokens, setTokens] = useState<RegistryTokens | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateTokens = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/generate-registry-tokens", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ organizationId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to generate tokens");
            }

            const data = await response.json();
            setTokens(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                    Generate registry tokens for npm, Maven, and PyPI package access.
                </p>
                <GenerateTokenButton onClick={handleGenerateTokens} isLoading={isLoading} />
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {tokens && (
                <div className="flex flex-col gap-4">
                    <TokenDisplay
                        title="NPM Registry Token"
                        token={tokens.npm.token}
                        description="Use this token to authenticate with the npm registry"
                    />
                    <TokenDisplay
                        title="Maven Registry"
                        username={tokens.maven.username}
                        password={tokens.maven.password}
                        description="Use these credentials to authenticate with the Maven registry"
                    />
                    <TokenDisplay
                        title="PyPI Registry"
                        username={tokens.pypi.username}
                        password={tokens.pypi.password}
                        description="Use these credentials to authenticate with the PyPI registry"
                    />
                </div>
            )}

            {!tokens && !error && !isLoading && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                    <p className="text-sm text-gray-600">
                        No tokens generated yet. Click the button above to generate new tokens.
                    </p>
                </div>
            )}
        </div>
    );
}
