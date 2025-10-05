import { type ComponentProps, forwardRef } from "react";

import { useSearchHits } from "../../hooks/use-search-hits";
import * as Command from "../cmdk";

export const CommandEmpty = forwardRef<HTMLDivElement, ComponentProps<typeof Command.Empty>>(
    ({ children, ...props }, ref) => {
        const query = Command.useCommandState((state) => state.search);
        const items = useSearchHits();

        if (typeof query === "string" && query.trimStart().length === 0) {
            return null;
        }

        if (items.length > 0) {
            return null;
        }

        return (
            children ?? (
                <div
                    {...props}
                    ref={ref}
                    data-cmdk-empty=""
                    role="presentation"
                    style={{
                        padding: "1.5rem 0",
                        textAlign: "center",
                        color: "var(--cmdk-empty-color, #888)",
                        ...props.style
                    }}
                >
                    No results found for &ldquo;{query}&rdquo;.
                </div>
            )
        );
    }
);

CommandEmpty.displayName = "CommandEmpty";
