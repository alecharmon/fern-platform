import {
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CircleIcon,
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

interface CodeWidgetProps {
    wizardFormData: WizardFormData;
}

export function CodeWidget({ wizardFormData }: CodeWidgetProps) {
    const companyName = wizardFormData.docsSiteName || "Your Company";
    const docsUrl = wizardFormData.docsSiteUrl
        ? `${wizardFormData.docsSiteUrl}.docs.buildwithfern.com`
        : "mydocs.buildwithfern.com";
    const logoUrl = wizardFormData.logoUrl;

    return (
        <div className="border-border h-[450px] w-[57%] min-w-[720px] overflow-hidden rounded-xl border bg-white shadow-lg lg:block dark:border-gray-700 dark:bg-transparent">
            {/* Browser Chrome */}
            <div className="border-b-border flex h-10 items-center justify-between gap-2 border-b bg-white px-4 py-2 dark:border-b-gray-700 dark:bg-transparent">
                {/* Traffic lights */}
                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <div className="h-3 w-3 rounded-full bg-[#ED6B5D]" />
                        <div className="h-3 w-3 rounded-full bg-[#F4BE50]" />
                        <div className="h-3 w-3 rounded-full bg-[#61C554]" />
                    </div>
                    <div className="flex items-center gap-3">
                        <ChevronLeftIcon className="h-4 w-4 text-gray-600 dark:text-white" />
                        <ChevronRightIcon className="h-4 w-4 text-gray-600 dark:text-white" />
                    </div>
                </div>

                {/* URL bar */}
                <div className="flex items-center justify-between gap-8 rounded-md border border-gray-900 bg-gray-200 px-3 py-1 dark:bg-gray-800">
                    <LockIcon className="h-3 w-3 text-gray-600 dark:text-white" />
                    <span className="text-xs text-gray-600 dark:text-white">{docsUrl}</span>
                    <RotateCwIcon className="h-3 w-3 text-gray-600 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <UploadIcon className="h-4 w-4 text-gray-600 dark:text-white" />
                    <PlusIcon className="h-4 w-4 text-gray-600 dark:text-white" />
                </div>
            </div>
            <div className="border-b-border flex h-10 items-center justify-between gap-2 border-b bg-white px-4 py-2 dark:border-b-gray-700 dark:bg-transparent">
                {/* URL bar */}
                <div className="flex min-w-[150px] max-w-[150px] items-center gap-2">
                    {logoUrl ? (
                        <div className="flex items-center gap-2">
                            {/* biome-ignore lint/performance/noImgElement: false positive */}
                            <img
                                src={logoUrl}
                                alt={companyName}
                                className="h-6 w-auto max-w-[70px] rounded-lg object-contain"
                            />
                            {companyName && (
                                <span className="text-sm text-gray-700 dark:text-white">{companyName}</span>
                            )}
                        </div>
                    ) : (
                        <>
                            <CircleIcon className="h-5 w-5 fill-current text-gray-600 dark:text-white" />
                            <span className="text-sm tracking-wide text-gray-700 dark:text-white">{companyName}</span>
                        </>
                    )}
                </div>
                <div className="mx-auto max-w-md flex-1">
                    <div className="flex items-center justify-between rounded-md border border-gray-900 bg-gray-200 px-3 py-1 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                            <SearchIcon className="h-3 w-3 text-gray-600 dark:text-white" />
                            <span className="text-xs text-gray-600 dark:text-white">Search</span>
                        </div>
                        <div className="dark:border-gray-1100 flex h-4 w-4 items-center justify-center gap-2 rounded-md border border-gray-900 bg-gray-200 dark:bg-gray-400">
                            <SlashIcon className="h-2 w-2 text-gray-600 dark:text-white" />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <SunIcon className="h-4 w-4 text-gray-600 dark:text-white" />
                    <div className="min-h-4 min-w-10 rounded-lg bg-gray-200 dark:bg-gray-400" />
                </div>
            </div>

            {/* Content area */}
            <div className="flex h-[calc(100%-33px)]">
                {/* Sidebar */}
                <div className="min-w-[220px] border-r border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-transparent">
                    {/* Top nav items with icons */}
                    <div className="mb-4 space-y-1">
                        <div className="flex items-center gap-3 rounded bg-gray-100 px-3 py-2.5 dark:bg-gray-800">
                            <LayoutGridIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                            <div className="h-2.5 w-24 rounded bg-gray-300 dark:bg-gray-600" />
                        </div>
                        <div className="flex items-center gap-3 rounded px-3 py-2.5">
                            <LockKeyholeIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                        </div>
                        <div className="flex items-center gap-3 rounded px-3 py-2.5">
                            <TriangleAlertIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <div className="h-2.5 w-16 rounded bg-gray-200 dark:bg-gray-700" />
                        </div>
                        <div className="flex items-center gap-3 rounded px-3 py-2.5">
                            <MoreHorizontalIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-gray-700" />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="my-4 border-t border-gray-200 dark:border-gray-700" />

                    {/* API Endpoints section */}
                    <div className="space-y-1">
                        {/* Section header with caret */}
                        <div className="flex items-center gap-2 px-3 py-1.5">
                            <ChevronDownIcon className="dark:text-gray-1100 h-3 w-3 text-gray-400" />
                            <div className="h-2 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                        </div>

                        {/* API endpoints with HTTP methods */}
                        <div className="space-y-0.5 pl-5">
                            {[{ method: "GET" }, { method: "GET" }, { method: "POST" }, { method: "POST" }].map(
                                (endpoint, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                                        <div
                                            className={`min-w-[35px] rounded bg-gray-800 px-1.5 py-0.5 text-center font-mono text-[10px] tracking-wide text-white dark:bg-gray-400`}
                                        >
                                            {endpoint.method}
                                        </div>
                                        <div className="h-2 w-24 rounded bg-gray-100 dark:bg-gray-800" />
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 overflow-auto bg-gray-50 p-8 dark:bg-transparent">
                    <div className="max-w-3xl">
                        {/* Heading */}
                        <div className="mb-8 flex flex-col gap-2">
                            <h1 className="text-xl font-medium text-gray-800 dark:text-white">
                                Welcome to {companyName}&apos;s API Docs
                            </h1>
                            <p className="dark:text-gray-1100 text-sm text-gray-500">
                                This is the API docs for {companyName}.
                            </p>
                        </div>

                        {/* Hero image placeholder */}
                        <div className="mb-8 h-32 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-400">
                            {/* biome-ignore lint/performance/noImgElement: false positive */}
                            <img src="/leaves.png" alt="Hero" className="h-full w-full object-cover" />
                        </div>

                        {/* Content boxes */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-400">
                                <div className="space-y-2">
                                    <div className="h-2 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                                    <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-800" />
                                    <div className="h-2 w-5/6 rounded bg-gray-200 dark:bg-gray-800" />
                                </div>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-400">
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
