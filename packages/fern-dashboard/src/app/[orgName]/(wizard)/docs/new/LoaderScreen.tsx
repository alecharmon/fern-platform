import { Loader2Icon } from "lucide-react";

import CodeWidget from "./CodeWidget";
import type { WizardFormData } from "./page";

interface LoaderScreenProps {
    wizardFormData: WizardFormData;
    loadingMessage?: string;
}

export default function LoaderScreen({
    wizardFormData,
    loadingMessage = "Reading your docs.yml..."
}: LoaderScreenProps) {
    return (
        <div className="flex w-full flex-col items-center justify-center gap-8">
            {/* Title */}
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Publishing your docs site!</h1>

            {/* Code Widget */}
            <CodeWidget wizardFormData={wizardFormData} />

            {/* Spinner and message */}
            <div className="flex items-center gap-3">
                <Loader2Icon className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">{loadingMessage}</p>
            </div>
        </div>
    );
}
