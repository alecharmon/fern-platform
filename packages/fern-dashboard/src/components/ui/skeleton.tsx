import { cn } from "@/utils/utils";

function Skeleton({ className, children, ...props }: React.ComponentProps<"div">) {
    return (
        <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-gray-400", className)} {...props}>
            <div className="invisible truncate">{children}</div>
        </div>
    );
}

export { Skeleton };
