import { cn } from "@/utils/utils";

export default function Card({
    children,
    className,
    style
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <div
            className={cn(
                "border-border flex min-w-0 flex-1 gap-6 rounded-xl border bg-gray-100 p-3 transition-[padding] sm:p-4 md:p-5 lg:p-6",
                className
            )}
            style={style}
        >
            {children}
        </div>
    );
}
