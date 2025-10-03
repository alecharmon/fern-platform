import { cn } from "@/utils/utils";

export function AnalyticsHistogramTabItem({
    title,
    icon,
    isSelected,
    onClick
}: {
    title: string;
    icon?: React.ReactNode;
    isSelected?: boolean;
    onClick?: () => void;
}) {
    const className = cn(
        "flex flex-row items-center gap-2 px-4 py-2 transition",
        isSelected ? "text-gray-1100" : "text-gray-900",
        "hover:text-gray-1100 cursor-pointer"
    );

    return (
        <div className="flex flex-col">
            <button onClick={onClick} className={className}>
                <span className="flex items-center">{icon}</span>
                {title}
            </button>
            {isSelected && <div className="bg-gray-1100 h-0.5 rounded-full dark:bg-gray-700" />}
        </div>
    );
}
