"use client";

import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ChromePicker } from "react-color";

import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TEMPLATES = [
    { id: "classic", name: "Classic", previewUrl: "https://docs-templates-classic.docs.buildwithfern.com" },
    { id: "minimal", name: "Minimal", previewUrl: "https://docs-templates-minimal.docs.buildwithfern.com" },
    { id: "products", name: "Products", previewUrl: "https://docs-templates-products.docs.buildwithfern.com" }
];

const HEADING_FONTS = [
    { label: "Default", value: "" },
    { label: "Inter", value: "Inter" },
    { label: "Roboto", value: "Roboto" },
    { label: "Open Sans", value: "Open Sans" },
    { label: "Lato", value: "Lato" },
    { label: "Poppins", value: "Poppins" },
    { label: "Montserrat", value: "Montserrat" },
    { label: "Nunito", value: "Nunito" },
    { label: "Raleway", value: "Raleway" },
    { label: "Work Sans", value: "Work Sans" }
];

const BODY_FONTS = [
    { label: "Default", value: "" },
    { label: "Inter", value: "Inter" },
    { label: "Roboto", value: "Roboto" },
    { label: "Open Sans", value: "Open Sans" },
    { label: "Lato", value: "Lato" },
    { label: "Source Sans Pro", value: "Source Sans Pro" },
    { label: "Nunito", value: "Nunito" },
    { label: "PT Sans", value: "PT Sans" },
    { label: "Merriweather", value: "Merriweather" }
];

const CODE_FONTS = [
    { label: "Default", value: "" },
    { label: "JetBrains Mono", value: "JetBrains Mono" },
    { label: "Fira Code", value: "Fira Code" },
    { label: "Source Code Pro", value: "Source Code Pro" },
    { label: "IBM Plex Mono", value: "IBM Plex Mono" },
    { label: "Roboto Mono", value: "Roboto Mono" },
    { label: "Ubuntu Mono", value: "Ubuntu Mono" }
];

function CustomizePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const templateId = searchParams.get("template") || "classic";

    const template = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0]!;

    const [primaryColor, setPrimaryColor] = useState<string | null>(null);
    const [headingsFont, setHeadingsFont] = useState("");
    const [bodyFont, setBodyFont] = useState("");
    const [codeFont, setCodeFont] = useState("");
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };

        if (isPickerOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isPickerOpen]);

    const handleContinue = () => {
        // Store customization in sessionStorage for the setup page to read
        sessionStorage.setItem(
            "docsCustomization",
            JSON.stringify({
                templateId,
                primaryColor,
                headingsFont,
                bodyFont,
                codeFont
            })
        );

        // Navigate to setup page for organization selection
        router.push("/create-docs/setup");
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
                <g opacity="0.1" filter="url(#filter0_f_customize)">
                    <path
                        d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                        fill="#51C233"
                    />
                </g>
                <defs>
                    <filter
                        id="filter0_f_customize"
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
                        href={`/create-docs/templates`}
                        className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </div>
            </motion.div>

            {/* Main content */}
            <div className="relative z-10 flex flex-1 gap-8 px-8 pb-8">
                {/* Left sidebar - Customization options */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="flex w-80 flex-shrink-0 flex-col"
                >
                    <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">Customize your docs</h1>
                    <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                        All fields are optional. You can customize these later.
                    </p>

                    <div className="flex flex-col gap-6">
                        {/* Primary Color */}
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium text-gray-900 dark:text-white">Primary Color</Label>
                            <div className="relative flex items-center gap-3">
                                <div
                                    className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-gray-300 transition-all hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
                                    onClick={() => setIsPickerOpen(!isPickerOpen)}
                                >
                                    <div
                                        className="h-full w-full"
                                        style={{ backgroundColor: primaryColor ?? "#e5e5e5" }}
                                    />
                                </div>
                                <span
                                    className="cursor-pointer font-mono text-sm text-gray-700 dark:text-gray-300"
                                    onClick={() => setIsPickerOpen(!isPickerOpen)}
                                >
                                    {primaryColor ? primaryColor.toUpperCase() : "Not set"}
                                </span>

                                {isPickerOpen && (
                                    <div ref={pickerRef} className="absolute left-0 top-12 z-50">
                                        <ChromePicker
                                            color={primaryColor ?? "#000000"}
                                            onChange={(color) => setPrimaryColor(color.hex)}
                                            disableAlpha
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fonts Section */}
                        <div className="flex flex-col gap-4">
                            <Label className="text-sm font-medium text-gray-900 dark:text-white">Typography</Label>

                            {/* Headings Font */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-gray-600 dark:text-gray-400">Headings</label>
                                <Select value={headingsFont} onValueChange={setHeadingsFont}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Default" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HEADING_FONTS.map((font) => (
                                            <SelectItem key={font.value} value={font.value || "default"}>
                                                {font.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Body Font */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-gray-600 dark:text-gray-400">Body</label>
                                <Select value={bodyFont} onValueChange={setBodyFont}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Default" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BODY_FONTS.map((font) => (
                                            <SelectItem key={font.value} value={font.value || "default"}>
                                                {font.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Code Font */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-gray-600 dark:text-gray-400">Code</label>
                                <Select value={codeFont} onValueChange={setCodeFont}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Default" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CODE_FONTS.map((font) => (
                                            <SelectItem key={font.value} value={font.value || "default"}>
                                                {font.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                Want a custom font? You can configure this manually in your docs.yml later.
                            </p>
                        </div>
                    </div>

                    {/* Continue button */}
                    <button
                        onClick={handleContinue}
                        className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 font-medium text-white transition-colors hover:bg-green-600"
                    >
                        Continue
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    {/* Skip link */}
                    <button
                        onClick={() => {
                            sessionStorage.setItem("docsCustomization", JSON.stringify({ templateId }));
                            router.push("/create-docs/setup");
                        }}
                        className="mt-3 text-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                        Skip customization
                    </button>
                </motion.div>

                {/* Right side - Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex flex-1 flex-col"
                >
                    {/* Template name badge */}
                    <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {template.name} template
                        </span>
                    </div>

                    {/* Browser chrome */}
                    <div className="overflow-hidden rounded-t-xl border border-b-0 border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                            <div className="flex gap-2">
                                <div className="h-3 w-3 rounded-full bg-red-400" />
                                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                                <div className="h-3 w-3 rounded-full bg-green-400" />
                            </div>
                            <div className="ml-4 flex flex-1 items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    />
                                </svg>
                                <span className="truncate">{template.previewUrl}</span>
                            </div>
                        </div>
                    </div>

                    {/* Iframe */}
                    <div className="relative flex-1 overflow-hidden rounded-b-xl border border-t-0 border-gray-200 bg-white dark:border-gray-700">
                        <iframe
                            src={template.previewUrl}
                            className="h-full w-full"
                            title={`Preview of ${template.name}`}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default function CustomizePage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-green-500" />
                </div>
            }
        >
            <CustomizePageContent />
        </Suspense>
    );
}
