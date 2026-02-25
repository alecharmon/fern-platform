import { cn } from "../cn";

export function AbstractHeaderTabsRoot({
    children,
    className,
    searchBar
}: {
    children: React.ReactNode;
    className?: string;
    searchBar?: React.ReactNode;
}) {
    return (
        <div className={cn("fern-header-tabs", className)}>
            {children}
            {searchBar}
        </div>
    );
}
