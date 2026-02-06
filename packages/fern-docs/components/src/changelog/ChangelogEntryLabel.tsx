import type { ReactNode } from "react";
import { Badge } from "../badges";

interface ChangelogEntryLabelProps {
    title: ReactNode;
    tags?: ReactNode;
    asChild?: boolean;
}

export function ChangelogEntryLabel({ title, tags, asChild }: ChangelogEntryLabelProps) {
    return (
        <div className="fern-changelog-label">
            <Badge asChild={asChild}>{title}</Badge>
            {tags && <div className="filter-row">{tags}</div>}
        </div>
    );
}
