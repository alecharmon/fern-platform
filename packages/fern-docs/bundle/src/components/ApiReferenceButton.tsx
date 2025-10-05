import { ArrowUpRight } from "lucide-react";

import { slugToHref } from "@fern-api/docs-utils";
import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";

export const ApiReferenceButton: React.FC<{ slug: string }> = ({ slug }) => {
    return (
        <FernTooltipProvider>
            <FernTooltip content="Open in API reference">
                <FernLinkButton
                    className="-m-1"
                    rounded
                    variant="minimal"
                    icon={<ArrowUpRight className="size-icon" />}
                    href={slugToHref(slug)}
                    scroll={true}
                />
            </FernTooltip>
        </FernTooltipProvider>
    );
};
