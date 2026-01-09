"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const GENERIC_ERROR = "CI test login failed. Please check your credentials.";

export function CITestLoginForm({ redirectOnLogin }: { redirectOnLogin?: string }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/login/ci-test", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password,
                    redirect_on_login: redirectOnLogin
                })
            });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error ?? "Request failed");
            }

            const data = (await response.json()) as { redirectUrl?: string };
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
                return;
            }

            throw new Error("Missing redirect");
        } catch (err) {
            console.error("CI test login failed", err);
            setError(err instanceof Error ? err.message : GENERIC_ERROR);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="mb-3 text-sm font-medium text-amber-700 dark:text-amber-400">
                CI Automated Testing Login
            </div>
            <form className="flex w-full flex-col gap-3" onSubmit={handleSubmit}>
                <Input
                    required
                    type="email"
                    inputMode="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    aria-invalid={error ? "true" : "false"}
                    data-testid="ci-email-input"
                />
                <Input
                    required
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    aria-invalid={error ? "true" : "false"}
                    data-testid="ci-password-input"
                />
                <Button type="submit" disabled={isSubmitting} variant="outline" data-testid="ci-submit-button">
                    {isSubmitting ? "Authenticating..." : "Sign in with test credentials"}
                </Button>
                {error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}
            </form>
        </div>
    );
}
