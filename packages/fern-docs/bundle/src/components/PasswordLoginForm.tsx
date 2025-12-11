"use client";

import { Button } from "@fern-docs/components/button";
import { FernInput } from "@fern-docs/components/FernInput";
import { Loader2, Lock } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useApiRoute } from "./hooks/useApiRoute";

interface PasswordLoginFormProps {
    returnTo: string;
}

export default function PasswordLoginForm({ returnTo }: PasswordLoginFormProps) {
    const apiRoute = useApiRoute("/api/fern-docs/auth/password");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch(apiRoute, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                // Show redirecting state before navigating
                setIsLoading(false);
                setIsRedirecting(true);
                // Use full page navigation to ensure the browser sends the new auth cookie
                // router.push() does client-side navigation which may not pick up the cookie
                window.location.href = returnTo || "/";
            } else if (response.status === 401) {
                setError("Invalid password");
                setIsLoading(false);
            } else {
                const data = await response.json().catch(() => ({}));
                setError(data.error || "An error occurred");
                setIsLoading(false);
            }
        } catch {
            setError("Failed to connect to server");
            setIsLoading(false);
        }
    }

    const isPending = isLoading || isRedirecting;

    return (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-2">
                <FernInput
                    id="password"
                    type="password"
                    className="h-[36px]"
                    value={password}
                    onValueChange={setPassword}
                    leftIcon={<Lock className="size-icon" />}
                    placeholder="Enter password"
                    required
                    autoFocus
                    disabled={isPending}
                    lang="en"
                />
            </div>

            {error && (
                <p className="text-sm text-(--red-11)" role="alert">
                    {error}
                </p>
            )}

            <Button type="submit" disabled={isPending || !password} className="h-[36px]">
                {isPending && <Loader2 className="animate-spin" />}
                {isLoading ? "Signing in..." : isRedirecting ? "Opening..." : "Continue"}
            </Button>
        </form>
    );
}
