import { slugToHref } from "@fern-api/docs-utils";
import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { ArrowUpRight } from "lucide-react";

import { I18N } from "@/constants";

export const ApiReferenceButton: React.FC<{ slug: string }> = ({ slug }) => {
    return (
        <FernTooltipProvider>
            <FernTooltip content={I18N.apiReference.openInApiReference}>
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
