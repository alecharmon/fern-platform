"use client";

import { Button } from "@fern-docs/components/button";
import { FernInput } from "@fern-docs/components/FernInput";
import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useApiRoute } from "./hooks/useApiRoute";

interface PasswordLoginFormProps {
    returnTo: string;
}

export default function PasswordLoginForm({ returnTo }: PasswordLoginFormProps) {
    const router = useRouter();
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
                // Redirect to the return URL
                router.push(returnTo || "/");
                router.refresh();
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
            <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-medium text-(color:--grayscale-a11)">
                    Password
                </label>
                <FernInput
                    id="password"
                    type="password"
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
                <p className="text-sm text-(color:--red-11)" role="alert">
                    {error}
                </p>
            )}

            <Button type="submit" disabled={isPending || !password}>
                {isPending && <Loader2 className="animate-spin" />}
                {isLoading ? "Signing in..." : isRedirecting ? "Redirecting..." : "Sign in"}
            </Button>
        </form>
    );
}
