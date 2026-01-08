"use client";

import { Globe, LayoutTemplate } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";

export default function CreateDocsPage() {
    return (
        <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden">
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
                <g opacity="0.1" filter="url(#filter0_f_create_docs)">
                    <path
                        d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                        fill="#51C233"
                    />
                </g>
                <defs>
                    <filter
                        id="filter0_f_create_docs"
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

            {/* Header with Fern logo */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 w-full p-4"
            >
                <div className="flex items-center">
                    <Link href="/">
                        <ThemedFernLogo className="w-16" />
                    </Link>
                </div>
            </motion.div>

            {/* Main content */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="mb-12 text-center text-3xl font-semibold text-gray-900 dark:text-white md:text-4xl"
                >
                    Choose how to configure your site
                </motion.h1>

                {/* Option cards */}
                <div className="flex flex-col gap-6 md:flex-row">
                    {/* Template option */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <Link href="/create-docs/templates">
                            <div className="group relative flex h-48 w-72 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600">
                                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                                    <LayoutTemplate className="h-7 w-7" />
                                </div>
                                <div className="text-center">
                                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                                        Select from templates
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        Choose a pre-built template to get started quickly
                                    </p>
                                </div>
                            </div>
                        </Link>
                    </motion.div>

                    {/* Existing site option (coming soon) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                    >
                        <div className="relative flex h-48 w-72 cursor-not-allowed flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white/50 p-6 opacity-60 dark:border-gray-700 dark:bg-gray-800/50">
                            {/* Coming soon badge */}
                            <span className="absolute right-3 top-3 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                Coming soon
                            </span>
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                                <Globe className="h-7 w-7" />
                            </div>
                            <div className="text-center">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                                    Enter an existing site
                                </h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Import configuration from an existing docs site
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
