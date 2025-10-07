import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4 max-w-content-width">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        </div>
    );
}
