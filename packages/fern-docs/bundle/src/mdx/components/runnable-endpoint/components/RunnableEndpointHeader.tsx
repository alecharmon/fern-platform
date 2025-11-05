import { slugToHref } from "@fern-api/docs-utils";
import type { EndpointDefinition, EnvironmentId } from "@fern-api/fdr-sdk/api-definition";
import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { FernTooltip } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import { ChevronDown, ExternalLink } from "lucide-react";
import { EndpointUrlWithOverflow } from "@/components/api-reference/endpoints/EndpointUrlWithOverflow";

interface RunnableEndpointHeaderProps {
    endpoint: EndpointDefinition;
    environmentId: EnvironmentId | undefined;
    baseUrl: string | undefined;
    formExpanded: boolean;
    onToggleForm: () => void;
    hasMultipleExamples: boolean;
    exampleOptions: { type: "value"; label: string; value: string }[];
    selectedExampleIndex: number;
    onExampleChange: (value: string) => void;
    endpointSlug?: string;
    lang: string;
}

export function RunnableEndpointHeader({
    endpoint,
    environmentId,
    baseUrl,
    formExpanded,
    onToggleForm,
    hasMultipleExamples,
    exampleOptions,
    selectedExampleIndex,
    onExampleChange,
    endpointSlug,
    lang
}: RunnableEndpointHeaderProps) {
    return (
        <div className="border-border-default flex w-full items-center justify-between border-b bg-tag-default px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                    type="button"
                    onClick={onToggleForm}
                    className="hover:bg-tag-default/50 rounded-sm p-1 transition-colors"
                    aria-label={formExpanded ? "Collapse form" : "Expand form"}
                >
                    <ChevronDown
                        className={cn("size-4 shrink-0 transition-transform", {
                            "-rotate-90": !formExpanded
                        })}
                    />
                </button>
                <div className="min-w-0 flex-1">
                    <EndpointUrlWithOverflow
                        path={endpoint.path}
                        method={endpoint.method}
                        environmentId={environmentId}
                        baseUrl={baseUrl}
                        options={endpoint.environments}
                        showEnvironment={true}
                        hideCopyButton={false}
                        lang={lang}
                    />
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {hasMultipleExamples && (
                    <FernDropdown
                        value={String(selectedExampleIndex)}
                        options={exampleOptions}
                        onValueChange={onExampleChange}
                        lang={lang}
                    >
                        <FernButton
                            text={
                                exampleOptions.find((opt) => opt.value === String(selectedExampleIndex))?.label ??
                                "Select Example"
                            }
                            rightIcon={<ChevronDown className="!size-icon" />}
                            size="small"
                            variant="outlined"
                            mono={false}
                        />
                    </FernDropdown>
                )}
                {endpointSlug && (
                    <FernTooltip content={t(lang).apiReference.openInApiReference}>
                        <FernLinkButton
                            className="-m-1"
                            rounded
                            variant="minimal"
                            icon={<ExternalLink className="!size-icon" />}
                            href={slugToHref(endpointSlug)}
                            scroll={true}
                        />
                    </FernTooltip>
                )}
            </div>
        </div>
    );
}
