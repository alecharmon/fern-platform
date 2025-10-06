import { Ellipsis, EllipsisVertical } from "lucide-react";
import { forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

export default forwardRef<
    HTMLButtonElement,
    React.ComponentPropsWithoutRef<typeof Button> & {
        orientation?: "vertical" | "horizontal";
    }
>(function EllipsisButton({ className, orientation = "vertical", ...props }, ref) {
    return (
        <Button
            ref={ref}
            variant="ghost"
            size="iconSm"
            className={cn("z-10 h-auto w-auto p-2 hover:bg-gray-400/50", className)}
            {...props}
        >
            {orientation === "vertical" ? <EllipsisVertical /> : <Ellipsis />}
        </Button>
    );
});
