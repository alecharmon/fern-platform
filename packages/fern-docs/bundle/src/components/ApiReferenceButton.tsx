import { slugToHref } from "@fern-api/docs-utils";
import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import { ArrowUpRight } from "lucide-react";

export const ApiReferenceButton: React.FC<{ slug: string; lang: string }> = ({ slug, lang }) => {
    return (
        <FernTooltipProvider>
            <FernTooltip content={t(lang).apiReference.openInApiReference}>
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
