"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useState } from "react";

import { ToolLayout } from "@/app/_components/ToolLayout";
import { InternalApiClient } from "@/app/_lib/api-client";

export default function TestApiPage() {
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState<string>("");

    const handleTest = useCallback(async () => {
        setStatus("loading");
        setMessage("");
        try {
            await InternalApiClient.test();
            setStatus("success");
            setMessage("Auth check passed — API returned 200 OK");
        } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Unknown error");
        }
    }, []);

    return (
        <ToolLayout
            title="Test API"
            description="Calls GET /api/test to verify that API authentication is working correctly."
        >
            <div className="border-border rounded-xl border bg-gray-100 p-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <h2 className="text-sm font-medium">Run auth check</h2>
                        <p className="text-gray-1000 text-xs">Sends a request with your current session credentials</p>
                    </div>
                    <button
                        onClick={handleTest}
                        disabled={status === "loading"}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {status === "loading" ? "Running..." : status === "idle" ? "Run" : "Run again"}
                    </button>
                </div>

                {status === "success" && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-300 p-3">
                        <CheckCircle2 className="text-green-1100 size-4 shrink-0" />
                        <p className="text-green-1200 text-xs font-medium">{message}</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="bg-destructive/10 mt-4 flex items-center gap-2 rounded-lg p-3">
                        <XCircle className="text-destructive size-4 shrink-0" />
                        <p className="text-destructive text-xs font-medium">{message}</p>
                    </div>
                )}
            </div>
        </ToolLayout>
    );
}
