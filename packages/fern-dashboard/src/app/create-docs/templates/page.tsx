"use client";

import { ArrowLeft, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";

interface Template {
    id: string;
    name: string;
    description: string;
    previewUrl: string;
}

const TEMPLATES: Template[] = [
    {
        id: "classic",
        name: "Classic",
        description: "Header tabs with full page width",
        previewUrl: "https://docs-templates-classic.docs.buildwithfern.com"
    },
    {
        id: "minimal",
        name: "Minimal",
        description: "Sidebar-only navigation, no header",
        previewUrl: "https://docs-templates-minimal.docs.buildwithfern.com"
    },
    {
        id: "products",
        name: "Products",
        description: "Multi-product docs with product switcher",
        previewUrl: "https://docs-templates-products.docs.buildwithfern.com"
    }
];

export default function TemplatesPage() {
    const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATES[0]!.id);
    const [slideDirection, setSlideDirection] = useState<"up" | "down">("down");
    const [loadedTemplates, setLoadedTemplates] = useState<Set<string>>(new Set());

    const currentTemplate = TEMPLATES.find((t) => t.id === selectedTemplate) || TEMPLATES[0]!;
    const isCurrentLoaded = loadedTemplates.has(selectedTemplate);

    const handleTemplateChange = (templateId: string) => {
        if (templateId !== selectedTemplate) {
            const currentIndex = TEMPLATES.findIndex((t) => t.id === selectedTemplate);
            const newIndex = TEMPLATES.findIndex((t) => t.id === templateId);
            setSlideDirection(newIndex > currentIndex ? "down" : "up");
            setSelectedTemplate(templateId);
        }
    };

    const handleIframeLoad = (templateId: string) => {
        setLoadedTemplates((prev) => new Set(prev).add(templateId));
    };

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
                <g opacity="0.1" filter="url(#filter0_f_templates)">
                    <path
                        d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                        fill="#51C233"
                    />
                </g>
                <defs>
                    <filter
                        id="filter0_f_templates"
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
            <div className="relative z-10 flex flex-1 gap-8 px-8 pb-8">
                {/* Left sidebar - Template selector */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="flex w-72 flex-shrink-0 flex-col"
                >
                    <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">Select a template</h1>

                    <div className="flex flex-col gap-3">
                        {TEMPLATES.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => handleTemplateChange(template.id)}
                                className={`relative flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all ${
                                    selectedTemplate === template.id
                                        ? "border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-900/20"
                                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                                }`}
                            >
                                {selectedTemplate === template.id && (
                                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                                <span className="font-medium text-gray-900 dark:text-white">{template.name}</span>
                                <span className="text-sm text-text-description">{template.description}</span>
                            </button>
                        ))}
                    </div>

                    {/* Continue button */}
                    <Link
                        href={`/create-docs/customize?template=${selectedTemplate}`}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 font-medium text-white transition-colors hover:bg-green-600"
                    >
                        Continue
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </motion.div>

                {/* Right side - Preview iframe */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex flex-1 flex-col"
                >
                    {/* Browser chrome */}
                    <div className="overflow-hidden rounded-t-xl border border-b-0 border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                        {/* Title bar */}
                        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                            {/* Traffic lights */}
                            <div className="flex gap-2">
                                <div className="h-3 w-3 rounded-full bg-red-400" />
                                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                                <div className="h-3 w-3 rounded-full bg-green-400" />
                            </div>
                            {/* URL bar */}
                            <div className="ml-4 flex flex-1 items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    />
                                </svg>
                                <span className="truncate">{currentTemplate.previewUrl}</span>
                            </div>
                        </div>
                    </div>

                    {/* Iframe container */}
                    <div className="relative flex-1 overflow-hidden rounded-b-xl border border-t-0 border-gray-200 bg-white dark:border-gray-700">
                        {/* Preload all iframes in background */}
                        {TEMPLATES.map((template) => (
                            <iframe
                                key={template.id}
                                src={template.previewUrl}
                                className="absolute inset-0 h-full w-full"
                                style={{
                                    visibility: "hidden",
                                    pointerEvents: "none"
                                }}
                                title={`Preload ${template.name}`}
                                onLoad={() => handleIframeLoad(template.id)}
                            />
                        ))}

                        {/* Visible iframe with animation */}
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={selectedTemplate}
                                initial={{ y: slideDirection === "down" ? 40 : -40, opacity: 0 }}
                                animate={{ y: 0, opacity: isCurrentLoaded ? 1 : 0 }}
                                exit={{ y: slideDirection === "down" ? -40 : 40, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="h-full w-full"
                            >
                                <iframe
                                    src={currentTemplate.previewUrl}
                                    className="h-full w-full"
                                    title={`Preview of ${currentTemplate.name}`}
                                />
                            </motion.div>
                        </AnimatePresence>

                        {/* Loading skeleton */}
                        <AnimatePresence>
                            {!isCurrentLoaded && (
                                <motion.div
                                    initial={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute inset-0 bg-gray-50 dark:bg-gray-900"
                                >
                                    <div className="h-full w-full animate-pulse">
                                        <div className="flex h-12 items-center gap-4 border-b border-gray-200 bg-gray-100 px-4 dark:border-gray-700 dark:bg-gray-800">
                                            <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                                            <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                                        </div>
                                        <div className="flex h-full">
                                            <div className="w-64 border-r border-gray-200 p-4 dark:border-gray-700">
                                                <div className="mb-4 h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                                                <div className="space-y-3">
                                                    <div className="h-8 rounded bg-gray-200 dark:bg-gray-700" />
                                                    <div className="h-8 rounded bg-gray-200 dark:bg-gray-700" />
                                                    <div className="h-8 rounded bg-gray-200 dark:bg-gray-700" />
                                                </div>
                                            </div>
                                            <div className="flex-1 p-8">
                                                <div className="mb-4 h-8 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                                                <div className="space-y-2">
                                                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
                                                    <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
                                                    <div className="h-4 w-4/6 rounded bg-gray-200 dark:bg-gray-700" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
