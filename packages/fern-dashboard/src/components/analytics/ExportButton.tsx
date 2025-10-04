import ArrowDownTrayIcon from "@heroicons/react/24/outline/ArrowDownTrayIcon";

import { Button } from "@/components/ui/button";

interface ExportButtonProps {
    onClick: () => void;
    isLoading?: boolean;
    disabled?: boolean;
}

export function ExportButton({ onClick, isLoading, disabled }: ExportButtonProps) {
    return (
        <Button
            size="lg"
            variant="outline"
            onClick={onClick}
            disabled={disabled || isLoading}
            className="text-gray-1200 shadow-xs flex h-[36px] items-center gap-2"
        >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {isLoading ? "Exporting..." : "Export CSV"}
        </Button>
    );
}
