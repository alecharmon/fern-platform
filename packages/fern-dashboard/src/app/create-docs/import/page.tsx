"use client";

import { AlertCircle, ArrowLeft, Globe, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";

function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export default function ImportPage() {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        setError(null);
    }, []);

    const handleContinue = useCallback(async () => {
        if (!url.trim()) {
            setError("Please enter a URL");
            return;
        }

        // Add protocol if missing
        let normalizedUrl = url.trim();
        if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
            normalizedUrl = `https://${normalizedUrl}`;
        }

        if (!isValidUrl(normalizedUrl)) {
            setError("Please enter a valid URL");
            return;
        }

        setIsValidating(true);
        setError(null);

        try {
            // Store the URL in sessionStorage for the processing page
            sessionStorage.setItem(
                "siteToDocsInput",
                JSON.stringify({
                    sourceUrl: normalizedUrl
                })
            );

            // Navigate to processing page
            router.push("/create-docs/import/processing");
        } catch (_err) {
            setError("Failed to validate URL. Please try again.");
            setIsValidating(false);
        }
    }, [url, router]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !isValidating) {
                handleContinue();
            }
        },
        [handleContinue, isValidating]
    );

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
                <g opacity="0.1" filter="url(#filter0_f_import)">
                    <path
                        d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                        fill="#51C233"
                    />
                </g>
                <defs>
                    <filter
                        id="filter0_f_import"
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
                    <Link
                        href="/create-docs"
                        className="flex items-center gap-2 text-sm text-text-description transition-colors hover:text-gray-1200"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </div>
            </motion.div>

            {/* Main content */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="w-full max-w-xl"
                >
                    {/* Icon */}
                    <div className="mb-6 flex justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            <Globe className="h-8 w-8" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="mb-2 text-center text-2xl font-semibold text-gray-900 dark:text-white">
                        Import from existing docs
                    </h1>
                    <p className="mb-8 text-center text-text-description">
                        Enter the URL of your documentation site and we'll convert it to a Fern project
                    </p>

                    {/* URL Input */}
                    <div className="mb-6">
                        <label
                            htmlFor="docs-url"
                            className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Documentation URL
                        </label>
                        <input
                            id="docs-url"
                            type="url"
                            value={url}
                            onChange={handleUrlChange}
                            onKeyDown={handleKeyDown}
                            placeholder="https://docs.example.com"
                            className={`w-full rounded-lg border px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 dark:text-white dark:placeholder-gray-500 ${
                                error
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-600"
                                    : "border-gray-300 focus:border-green-500 focus:ring-green-500/20 dark:border-gray-600 dark:focus:border-green-400"
                            } bg-white dark:bg-gray-800`}
                            autoFocus
                        />
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-2 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400"
                            >
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </motion.div>
                        )}
                    </div>

                    {/* Continue button */}
                    <button
                        onClick={handleContinue}
                        disabled={isValidating || !url.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isValidating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Validating...
                            </>
                        ) : (
                            <>
                                Continue
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </>
                        )}
                    </button>

                    {/* Info text */}
                    <p className="mt-4 text-center text-sm text-text-description">
                        We'll crawl your site and automatically generate a Fern documentation project
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
