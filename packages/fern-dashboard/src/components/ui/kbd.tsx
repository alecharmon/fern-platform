import { gtPlanar } from "@/app/fonts";
import { cn } from "@/utils/utils";

export function Kbd({
    children,
    className,
    useBodyFont = false
}: {
    children: React.ReactNode;
    className?: string;
    useBodyFont?: boolean;
}) {
    return (
        <kbd
            className={cn(
                "px-1.5 py-0.5 text-xs font-medium text-white dark:text-[var(--gray-100)] bg-[var(--green-1200)] rounded-[4px] flex items-center justify-center",
                useBodyFont ? gtPlanar.className : "",
                className
            )}
        >
            {children}
        </kbd>
    );
}
