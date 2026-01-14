import {
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    LayoutGridIcon,
    LockIcon,
    LockKeyholeIcon,
    MoreHorizontalIcon,
    PlusIcon,
    RotateCwIcon,
    SearchIcon,
    SlashIcon,
    SunIcon,
    TriangleAlertIcon,
    UploadIcon
} from "lucide-react";

import type { WizardFormData } from "@/providers/OnboardingProvider";
import { cn } from "@/utils/utils";
import { AnimatedText } from "./AnimatedText";
import { DotMatrix } from "./DotMatrix";

export type FocusArea = "none" | "title" | "url" | "logo";

interface CodeWidgetProps {
    wizardFormData: WizardFormData;
    className?: string;
    /** Which area of the widget to zoom/focus on */
    focusArea?: FocusArea;
}

const DEFAULT_LOGO_URL = "https://raw.githubusercontent.com/fern-api/docs-starter/main/fern/docs/assets/logo.svg";

/** Helper to create staggered animation delay styles */
function staggerDelay(index: number, baseDelay = 0, increment = 80): React.CSSProperties {
    return {
        animationDelay: `${baseDelay + index * increment}ms`,
        animationFillMode: "both"
    };
}

export function CodeWidget({ wizardFormData, className, focusArea = "none" }: CodeWidgetProps) {
    const hasCompanyName = Boolean(wizardFormData.docsSiteName);
    const hasDocsUrl = Boolean(wizardFormData.docsSiteUrl);
    const hasLogo = Boolean(wizardFormData.logoUrl);
    const companyName = wizardFormData.docsSiteName || "Your Company";
    const logoUrl = wizardFormData.logoUrl ?? DEFAULT_LOGO_URL;
    // const faviconUrl = wizardFormData.faviconUrl;

    // Calculate transform based on focus area
    // Use consistent transform origin for smooth transitions
    const getTransformStyle = (): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            transition: "transform 400ms ease-in-out"
        };

        switch (focusArea) {
            case "title":
                // Zoom into the main content heading area
                return {
                    ...baseStyle,
                    transform: "scale(1.4) translateX(-15%) translateY(8%)"
                };
            case "url":
                // Zoom into the URL bar area
                return {
                    ...baseStyle,
                    transform: "scale(1.6) translateX(-4%) translateY(35%)"
                };
            case "logo":
                // Zoom into the logo area
                return {
                    ...baseStyle,
                    transform: "scale(1.5) translateX(30%) translateY(30%)"
                };
            default:
                return {
                    ...baseStyle,
                    transform: "scale(1) translateX(0) translateY(0)"
                };
        }
    };

    return (
        <div
            className={cn(
                "border-border overflow-hidden rounded-xl border bg-background shadow-lg lg:block",
                className
            )}
            style={getTransformStyle()}
        >
            {/* Browser Chrome */}
            <div
                className="border-b-border flex h-10 items-center justify-between gap-2 border-b bg-white px-4 py-2 dark:border-b-gray-400 dark:bg-transparent animate-fade-in"
                style={staggerDelay(0)}
            >
                {/* Traffic lights */}
                <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                        <div className="size-3 rounded-full bg-[#ED6B5D]" />
                        <div className="size-3 rounded-full bg-[#F4BE50]" />
                        <div className="size-3 rounded-full bg-[#61C554]" />
                    </div>
                    <div className="flex items-center gap-3">
                        <ChevronLeftIcon className="h-4 w-4 text-gray-600 dark:text-gray-800" />
                        <ChevronRightIcon className="h-4 w-4 text-gray-600 dark:text-gray-800" />
                    </div>
                </div>

                {/* URL bar */}
                <div className="flex items-center justify-between gap-8 rounded-md border text-gray-1000 border-gray-300 bg-gray-200 px-3 py-1">
                    <div className="flex items-center gap-1">
                        <LockIcon className="size-3 text-gray-600 dark:text-gray-800" />
                    </div>
                    <div className="relative w-[200px] h-[12px]">
                        <span className="absolute inset-0 flex items-center text-xs truncate">
                            {hasDocsUrl ? (
                                <>
                                    <AnimatedText text={wizardFormData.docsSiteUrl ?? ""} />
                                    <span>.docs.buildwithfern.com</span>
                                </>
                            ) : null}
                        </span>
                        <div className="absolute inset-0 flex items-center">
                            <DotMatrix width={200} height={10} fade={false} visible={!hasDocsUrl} />
                        </div>
                    </div>
                    <RotateCwIcon className="size-3" />
                </div>
                <div className="flex items-center gap-2">
                    <UploadIcon className="h-4 w-4 text-gray-600 dark:text-gray-800" />
                    <PlusIcon className="h-4 w-4 text-gray-600 dark:text-gray-800" />
                </div>
            </div>
            <div
                className="border-b-border flex h-10 items-center justify-between gap-2 border-b bg-white px-4 py-2 dark:border-b-gray-400 dark:bg-transparent animate-fade-in"
                style={staggerDelay(1)}
            >
                {/* Logo area */}
                <div className="relative w-[120px] h-[20px]">
                    <div
                        className={cn(
                            "absolute inset-0 flex items-center transition-opacity duration-300",
                            hasLogo ? "opacity-100" : "opacity-0"
                        )}
                    >
                        {/* biome-ignore lint/performance/noImgElement: false positive */}
                        <img
                            src={logoUrl ?? undefined}
                            alt={companyName}
                            className="h-6 w-auto max-w-[70px] object-contain"
                        />
                    </div>
                    <div className="absolute inset-0 flex items-center">
                        <DotMatrix width={120} height={20} visible={!hasLogo} />
                    </div>
                </div>
                <div className="mx-auto max-w-md flex-1">
                    <div className="flex items-center justify-between text-gray-700 rounded-md border border-gray-300 px-3 py-1">
                        <div className="flex items-center gap-2">
                            <SearchIcon className="size-3" />
                            <span className="text-xs">Search</span>
                        </div>
                        <div className="dark:border-gray-400 flex size-4 items-center justify-center gap-2 rounded-md border border-gray-300 bg-gray-200 dark:bg-gray-400">
                            <SlashIcon className="size-2" />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <SunIcon className="size-4 text-gray-600 dark:text-gray-800" />
                    <div className="min-h-4 min-w-10 rounded-lg bg-gray-200 dark:bg-gray-400" />
                </div>
            </div>

            {/* Content area */}
            <div className="flex h-[calc(100%-33px)]">
                {/* Sidebar */}
                <div
                    className="min-w-[180px] w-1/5 border-r border-gray-400 bg-white p-4 dark:border-gray-400 dark:bg-transparent animate-fade-in"
                    style={staggerDelay(2)}
                >
                    {/* Top nav items with icons */}
                    <div className="mb-4 space-y-1">
                        <div className="flex items-center gap-3 rounded bg-gray-100 px-1 py-1 dark:bg-gray-200">
                            <LayoutGridIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                            <div className="h-2.5 w-24 rounded bg-gray-300 dark:bg-gray-400" />
                        </div>
                        <div className="flex items-center gap-3 rounded px-1 py-1">
                            <LockKeyholeIcon className="h-4 w-4 text-gray-400 dark:text-gray-400" />
                            <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-400" />
                        </div>
                        <div className="flex items-center gap-3 rounded px-1 py-1">
                            <TriangleAlertIcon className="h-4 w-4 text-gray-400 dark:text-gray-400" />
                            <div className="h-2.5 w-16 rounded bg-gray-200 dark:bg-gray-400" />
                        </div>
                        <div className="flex items-center gap-3 rounded px-1 py-1">
                            <MoreHorizontalIcon className="h-4 w-4 text-gray-400 dark:text-gray-400" />
                            <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-gray-400" />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="my-4 border-t border-gray-400 dark:border-gray-400" />

                    {/* API Endpoints section */}
                    <div className="space-y-1">
                        {/* Section header with caret */}
                        <div className="flex items-center gap-2 px-1 py-1">
                            <ChevronDownIcon className="dark:text-gray-400 h-3 w-3 text-gray-600" />
                            <div className="h-2 w-20 rounded bg-gray-200 dark:bg-gray-400" />
                        </div>

                        {/* API endpoints with HTTP methods */}
                        <div className="space-y-0.5 pl-5">
                            {[{ method: "GET" }, { method: "GET" }, { method: "POST" }, { method: "POST" }].map(
                                (endpoint, i) => (
                                    <div key={i} className="flex items-center gap-2 px-1 py-1">
                                        <div
                                            className={`rounded bg-gray-200 px-1.5 text-center font-mono text-[10px] tracking-wide text-gray-600 dark:text-gray-800 dark:bg-gray-400`}
                                        >
                                            {endpoint.method}
                                        </div>
                                        <div className="h-2 w-24 rounded bg-gray-200 dark:bg-gray-400" />
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 overflow-auto p-8 dark:bg-transparent">
                    <div className="max-w-3xl">
                        {/* Heading */}
                        <div className="mb-8 flex flex-col gap-2 animate-fade-in" style={staggerDelay(3)}>
                            <div className="relative h-7 w-[300px]">
                                <h1 className="absolute inset-0 flex items-center text-xl font-medium text-gray-800 dark:text-white whitespace-nowrap">
                                    {hasCompanyName && (
                                        <>
                                            Welcome to&nbsp;
                                            <AnimatedText text={companyName} />
                                            &apos;s API Docs
                                        </>
                                    )}
                                </h1>
                                <div className="absolute inset-0 flex items-center">
                                    <DotMatrix width={300} height={24} fade={false} visible={!hasCompanyName} />
                                </div>
                            </div>
                            <p className="dark:text-gray-800 text-sm text-gray-500">
                                This is the API docs for {companyName}.
                            </p>
                        </div>

                        {/* Hero image placeholder */}
                        <div
                            className="mb-8 h-32 w-full overflow-hidden rounded-lg border border-gray-400 bg-white dark:border-gray-400 dark:bg-gray-200 animate-fade-in"
                            style={staggerDelay(4)}
                        >
                            {/* <img src="/leaves.png" alt="Hero" className="h-full w-full object-cover" /> */}
                        </div>

                        {/* Content boxes */}
                        <div className="grid grid-cols-2 gap-4 animate-fade-in" style={staggerDelay(5)}>
                            <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-400">
                                <div className="space-y-2">
                                    <div className="h-2 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                                    <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-800" />
                                    <div className="h-2 w-5/6 rounded bg-gray-200 dark:bg-gray-800" />
                                </div>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-400">
                                <div className="dark:text-gray-1100 space-y-2 font-mono text-xs text-gray-600">
                                    <div>1 This is used</div>
                                    <div>2 for the</div>
                                    <div>3 code snippet font</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
