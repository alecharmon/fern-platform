import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import { cn } from "../cn";

interface ChangelogContentLayoutProps extends ComponentPropsWithoutRef<"div"> {
    as: "div" | "section" | "article";
    stickyContent?: ReactNode;
    children: ReactNode;
}

export function ChangelogContentLayout({
    as: Component,
    children,
    stickyContent,
    ...props
}: ChangelogContentLayoutProps): ReactElement<any> {
    const hasAside = stickyContent != null;
    return (
        <Component
            {...props}
            className={cn("fern-changelog-content", props.className)}
            data-has-aside={hasAside ? "true" : "false"}
        >
            {hasAside && <aside>{stickyContent}</aside>}
            <div className="max-w-content-width mx-auto w-full">
                {hasAside && <div className="eyebrow">{stickyContent}</div>}
                {children}
            </div>
        </Component>
    );
}
