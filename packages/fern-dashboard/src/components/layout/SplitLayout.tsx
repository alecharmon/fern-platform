import type { ReactNode } from "react";
import { cn } from "../../utils/utils";

export interface SplitLayoutProps {
    /**
     * Content to render in the white card on the left
     */
    cardContent: ReactNode;

    /**
     * Content to render in the background section on the right
     */
    backgroundContent: ReactNode;

    /**
     * When true, animates the card to the center of the screen
     * @default false
     */
    centerCard?: boolean;

    /**
     * Optional overlay content that appears on top of everything (e.g., logo, buttons)
     */
    overlay?: ReactNode;

    /**
     * Custom className for the card container
     */
    cardClassName?: string;

    /**
     * Custom className for the background container
     */
    backgroundClassName?: string;

    /**
     * Animation duration in milliseconds
     * @default 500
     */
    animationDuration?: number;
}

export const SplitLayout = ({
    cardContent,
    backgroundContent,
    centerCard = false,
    overlay,
    cardClassName,
    backgroundClassName,
    animationDuration = 700
}: SplitLayoutProps) => {
    return (
        <div
            className={cn(
                "relative flex flex-1",
                "transition-all ease-in-out",
                // When card is centered, make the container center its children
                centerCard && "md:justify-center"
            )}
            style={{
                transitionDuration: `${animationDuration}ms`
            }}
        >
            {/* Persistent background layer */}
            <div
                className={cn(
                    "absolute inset-0 hidden overflow-hidden md:flex",
                    "z-0",
                    // When card is not centered, position background to the right of the card
                    !centerCard && "md:left-[40%]",
                    backgroundClassName
                )}
            >
                {backgroundContent}
            </div>

            {overlay}

            {/* Left card section */}
            <div
                className={cn(
                    "bg-background relative z-10 flex items-center justify-center px-4",
                    // Mobile: full width, no border/shadow
                    "flex-1",
                    // Desktop: card styling with border and shadow
                    "md:mt-2 md:flex-initial md:rounded-t-2xl",
                    "md:border-x md:border-t md:border-border md:shadow-md",
                    // Default state: left side of screen
                    !centerCard && "md:ml-2 md:w-[40%] md:min-w-[350px]",
                    // Centered state: middle of screen - no margins, container handles centering
                    centerCard && "md:w-[60%] md:max-w-[800px] md:mx-2",
                    cardClassName
                )}
                style={{
                    transition: `all ${animationDuration}ms ease-in-out`
                }}
            >
                {cardContent}
            </div>

            {/* Layout placeholder keeps the left -> center animation smooth */}
            <div
                aria-hidden="true"
                className={cn(
                    "relative hidden flex-1 flex-col md:flex",
                    // Fade out and collapse when card is centered
                    centerCard && "md:opacity-0 md:w-0 md:flex-none md:pointer-events-none"
                )}
                style={{
                    transition: `opacity 200ms ease-in-out, width ${animationDuration}ms ease-in-out, flex ${animationDuration}ms ease-in-out`,
                    overflow: "hidden"
                }}
            />
        </div>
    );
};
