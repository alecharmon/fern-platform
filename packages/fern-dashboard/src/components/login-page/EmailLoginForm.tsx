"use client";

import { useEffect, useState } from "react";
import { LAST_USED_LOGIN_KEY } from "../auth/LoginButton";
import { getPylon } from "../pylon/getPylon";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Kbd } from "../ui/kbd";

const GENERIC_ERROR = "We couldn't start SSO for that email. Please try again, or";

export function EmailLoginForm({ redirectOnLogin }: { redirectOnLogin?: string }) {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLastUsed, setIsLastUsed] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
        try {
            const lastUsed = localStorage.getItem(LAST_USED_LOGIN_KEY);
            setIsLastUsed(lastUsed === "enterprise-sso");
        } catch {
            setIsLastUsed(false);
        }
    }, []);

    const openSupportChat = () => {
        getPylon()?.("show");
        getPylon()?.("showChatBubble");
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/login/email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    redirect_on_login: redirectOnLogin
                })
            });

            if (!response.ok) {
                throw new Error("Request failed");
            }

            const data = (await response.json()) as { redirectUrl?: string };
            if (data.redirectUrl) {
                try {
                    localStorage.setItem(LAST_USED_LOGIN_KEY, "enterprise-sso");
                } catch {}
                window.location.href = data.redirectUrl;
                return;
            }

            throw new Error("Missing redirect");
        } catch (err) {
            console.error("Email SSO request failed", err);
            setError(GENERIC_ERROR);
            setIsSubmitting(false);
        }
    };

    return (
        <form className="flex w-full flex-col gap-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-1100">
                <Input
                    required
                    type="email"
                    inputMode="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    aria-invalid={error ? "true" : "false"}
                    aria-describedby={error ? "email-error" : undefined}
                />
            </label>
            <Button type="submit" disabled={isSubmitting}>
                <div className="w-full grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    <div aria-hidden="true" />
                    <span>{isSubmitting ? "Authenticating..." : "Continue"}</span>
                    {hasMounted && isLastUsed ? (
                        <Kbd className="justify-self-end -mr-1" useBodyFont>
                            last used
                        </Kbd>
                    ) : (
                        <div aria-hidden="true" />
                    )}
                </div>
            </Button>
            {error && (
                <div
                    id="email-error"
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                    <span>{error}</span>{" "}
                    <button
                        type="button"
                        className="underline underline-offset-2 hover:text-destructive/80"
                        onClick={openSupportChat}
                    >
                        contact support
                    </button>
                    .
                </div>
            )}
        </form>
    );
}
