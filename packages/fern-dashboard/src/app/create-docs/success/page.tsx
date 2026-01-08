"use client";

import { CheckCircle2, ExternalLink, Github, Key, Loader2, Play, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function CollaboratorSection({
    repoName,
    initialCollaboratorAdded
}: {
    repoName: string;
    initialCollaboratorAdded: boolean;
}) {
    const [collaboratorAdded, setCollaboratorAdded] = useState(initialCollaboratorAdded);
    const [githubUsername, setGithubUsername] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleAddCollaborator = async () => {
        if (!githubUsername.trim()) {
            setError("Please enter a GitHub username");
            return;
        }

        setIsAdding(true);
        setError(null);

        try {
            const response = await fetch("/api/add-repo-collaborator", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    repoName,
                    githubUsername: githubUsername.trim()
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to add collaborator");
            }

            setCollaboratorAdded(true);
            setSuccessMessage(`Invitation sent to ${githubUsername}! Check your email to accept.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add collaborator");
        } finally {
            setIsAdding(false);
        }
    };

    if (collaboratorAdded) {
        return (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                            {successMessage || "You have access to this repository"}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                            {successMessage
                                ? "Check your GitHub email for the invitation."
                                : "You can clone and push to this repo."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
                <UserPlus className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Get access to this repository
                    </p>
                    <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
                        Enter your GitHub username to be added as a collaborator.
                    </p>
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            placeholder="github-username"
                            value={githubUsername}
                            onChange={(e) => setGithubUsername(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddCollaborator()}
                            disabled={isAdding}
                            className="h-9 flex-1 bg-white text-sm dark:bg-gray-900"
                        />
                        <Button
                            onClick={handleAddCollaborator}
                            disabled={isAdding || !githubUsername.trim()}
                            size="sm"
                            className="h-9 bg-amber-600 hover:bg-amber-700"
                        >
                            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add me"}
                        </Button>
                    </div>
                    {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
                    <p className="mt-2 text-xs text-amber-500 dark:text-amber-500">
                        No GitHub account? You can skip this and claim access later.
                    </p>
                </div>
            </div>
        </div>
    );
}

function SuccessPageContent() {
    const searchParams = useSearchParams();
    const repoUrl = searchParams.get("repo");
    const repoName = searchParams.get("repoName");
    const collaboratorAdded = searchParams.get("collaboratorAdded") === "true";
    const siteUrl = searchParams.get("siteUrl");
    const fernTokenSet = searchParams.get("fernTokenSet") === "true";

    // Trigger the workflow in the background when the page loads
    const workflowTriggered = useRef(false);
    useEffect(() => {
        if (!repoName || !fernTokenSet || workflowTriggered.current) {
            return;
        }
        workflowTriggered.current = true;

        // Fire and forget - trigger workflow in background
        fetch("/api/trigger-docs-workflow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoName })
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    console.log("✓ Publish workflow triggered successfully");
                } else {
                    console.error("Failed to trigger workflow:", data.error);
                }
            })
            .catch((err) => {
                console.error("Failed to trigger workflow:", err);
            });
    }, [repoName, fernTokenSet]);

    if (!repoUrl) {
        return (
            <div className="relative flex min-h-screen w-full flex-col items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">No repository URL found.</p>
                    <Link href="/create-docs/templates" className="mt-4 text-green-500 hover:text-green-600">
                        Start over
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden">
            {/* Radial gradient background */}
            <div className="bg-gradient-radial pointer-events-none absolute inset-0 from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black" />

            {/* Blurred green blob */}
            <svg
                className="pointer-events-none absolute"
                style={{
                    width: "1351px",
                    height: "525px",
                    left: "-90px",
                    bottom: "197px"
                }}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1001 656"
                fill="none"
            >
                <g opacity="0.1" filter="url(#filter0_f_success)">
                    <path
                        d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                        fill="#51C233"
                    />
                </g>
                <defs>
                    <filter
                        id="filter0_f_success"
                        x="0"
                        y="0"
                        width="1000.09"
                        height="655.083"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                        <feGaussianBlur stdDeviation="66" result="effect1_foregroundBlur" />
                    </filter>
                </defs>
            </svg>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 w-full p-4"
            >
                <div className="flex items-center justify-between">
                    <Link href="/">
                        <ThemedFernLogo className="w-16" />
                    </Link>
                </div>
            </motion.div>

            {/* Main content */}
            <div className="relative z-10 flex flex-1 items-center justify-center px-8 pb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="w-full max-w-lg text-center"
                >
                    {/* Success icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2, duration: 0.5 }}
                        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
                    >
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </motion.div>

                    <h1 className="mb-2 text-3xl font-semibold text-gray-900 dark:text-white">Repository created!</h1>
                    <p className="mb-8 text-gray-600 dark:text-gray-400">
                        Your documentation repository has been created successfully.
                    </p>

                    {/* Collaborator access section */}
                    {repoName && (
                        <CollaboratorSection repoName={repoName} initialCollaboratorAdded={collaboratorAdded} />
                    )}

                    {/* GitHub repo link card */}
                    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                                <Github className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">GitHub Repository</p>
                                <a
                                    href={repoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 flex items-center gap-1 truncate text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                >
                                    {repoUrl}
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* View Repository button */}
                    <Button asChild className="mb-8 w-full bg-green-500 hover:bg-green-600">
                        <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                            <Github className="mr-2 h-4 w-4" />
                            View Repository
                        </a>
                    </Button>

                    {/* Site URL preview */}
                    {siteUrl && (
                        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-left dark:border-blue-800 dark:bg-blue-900/20">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                                Your docs will be live at:
                            </p>
                            <p className="mt-1 font-mono text-sm text-blue-600 dark:text-blue-400">https://{siteUrl}</p>
                        </div>
                    )}

                    {/* Next steps */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-left dark:border-gray-700 dark:bg-gray-800/50">
                        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                            {fernTokenSet ? "Your Docs Are Publishing!" : "Publish Your Docs"}
                        </h2>
                        {fernTokenSet ? (
                            <>
                                <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    <p className="text-sm text-green-800 dark:text-green-300">
                                        FERN_TOKEN was automatically configured. Your docs will publish shortly!
                                    </p>
                                </div>
                                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                                    A GitHub Action is running now to publish your docs. Check the{" "}
                                    <a
                                        href={`${repoUrl}/actions`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-600 hover:text-green-700 dark:text-green-400"
                                    >
                                        Actions tab
                                    </a>{" "}
                                    to see the progress.
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Once complete, your docs will be live at{" "}
                                    <span className="font-medium">https://{siteUrl}</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                                    Your repo includes a GitHub Action that automatically publishes docs on push. Just
                                    add your Fern token:
                                </p>
                                <ol className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                                    <li className="flex gap-3">
                                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            <Key className="h-3 w-3" />
                                        </span>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                Add FERN_TOKEN secret
                                            </p>
                                            <p className="mt-1 text-gray-500 dark:text-gray-400">
                                                Go to{" "}
                                                <a
                                                    href={`${repoUrl}/settings/secrets/actions/new`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-green-600 hover:text-green-700 dark:text-green-400"
                                                >
                                                    Repository Settings → Secrets
                                                </a>{" "}
                                                and add{" "}
                                                <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">
                                                    FERN_TOKEN
                                                </code>{" "}
                                                with your token from{" "}
                                                <a
                                                    href="https://app.buildwithfern.com/tokens"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-green-600 hover:text-green-700 dark:text-green-400"
                                                >
                                                    Fern Dashboard
                                                </a>
                                                .
                                            </p>
                                        </div>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            <Play className="h-3 w-3" />
                                        </span>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                Trigger the workflow
                                            </p>
                                            <p className="mt-1 text-gray-500 dark:text-gray-400">
                                                Go to{" "}
                                                <a
                                                    href={`${repoUrl}/actions`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-green-600 hover:text-green-700 dark:text-green-400"
                                                >
                                                    Actions tab
                                                </a>{" "}
                                                and re-run the failed workflow, or push a change to trigger a new run.
                                            </p>
                                        </div>
                                    </li>
                                </ol>
                            </>
                        )}
                    </div>

                    {/* Link back to dashboard */}
                    <Link
                        href="/"
                        className="mt-6 inline-block text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                        Back to Dashboard
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-green-500" />
                </div>
            }
        >
            <SuccessPageContent />
        </Suspense>
    );
}
