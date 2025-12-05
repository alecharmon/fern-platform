import { FernCard } from "@fern-docs/components/FernCard";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";

interface PlaygroundEndpointFormSection {
    title?: ReactNode;
    ignoreHeaders: boolean | undefined;
    className?: string;
}

export function PlaygroundEndpointFormSection({
    title,
    ignoreHeaders,
    children,
    className
}: PropsWithChildren<PlaygroundEndpointFormSection>): ReactElement<any> | null {
    if (children == null) {
        return null;
    }
    return (
        <section className={className}>
            {!ignoreHeaders && title && (
                <div className="fern-explorer-section-header mb-4 px-4">
                    {typeof title === "string" ? <h5 className="text-(color:--grayscale-a11) m-0">{title}</h5> : title}
                </div>
            )}
            <FernCard className="fern-explorer-section-content rounded-3 p-4">{children}</FernCard>
        </section>
    );
}
