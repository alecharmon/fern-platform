import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                <p className="text-sm text-gray-500">Loading editor...</p>
            </div>
        </div>
    );
}
