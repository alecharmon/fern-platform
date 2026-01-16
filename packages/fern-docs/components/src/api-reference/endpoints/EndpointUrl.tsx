"use client";

import { type ApiMethodType, removeTrailingSlash } from "@fern-api/docs-utils";
import type { APIV1Read } from "@fern-api/fdr-sdk";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { sanitizeUrl, visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { t } from "@fern-docs/i18n";
import { useBooleanState, useCopyToClipboard } from "@fern-ui/react-commons";
import { composeRefs } from "@radix-ui/react-compose-refs";
import React, { type PropsWithChildren, type ReactElement, type ReactNode, useMemo, useRef, useState } from "react";
import { noop } from "ts-essentials";
import { ApiMethodBadge } from "../../badges";
import { CopyToClipboardButton } from "../../CopyToClipboardButton";
import { cn } from "../../cn";
import { FernTooltip, FernTooltipProvider } from "../../FernTooltip";

export declare namespace EndpointUrl {
    export type Props = React.PropsWithChildren<{
        path: ApiDefinition.PathPart[];
        method: ApiMethodType;
        baseUrl?: string;
        environmentId?: ApiDefinition.EnvironmentId;
        options?: APIV1Read.Environment[];
        showEnvironment?: boolean;
        hideCopyButton?: boolean;
        large?: boolean;
        className?: string;
        lang: string;
        readonly?: string[];
        /**
         * Optional render prop for environment dropdown.
         * If not provided and showEnvironment is true, a basic URL will be shown.
         */
        renderEnvironmentDropdown?: (props: {
            baseUrl?: string;
            environmentId?: ApiDefinition.EnvironmentId;
            options?: APIV1Read.Environment[];
            urlTextStyle: string;
            protocolTextStyle: string;
            isEditingEnvironment: ReturnType<typeof useBooleanState>;
            editable: boolean;
            lang: string;
            readonly?: string[];
        }) => ReactNode;
    }>;
}

// TODO: this component needs a refresh
export const EndpointUrl = React.forwardRef<HTMLDivElement, PropsWithChildren<EndpointUrl.Props>>(function EndpointUrl(
    {
        path,
        method,
        baseUrl,
        environmentId,
        large,
        className,
        showEnvironment,
        hideCopyButton,
        options,
        lang,
        readonly,
        renderEnvironmentDropdown
    },
    forwardedRef
) {
    const ref = useRef<HTMLDivElement>(null);

    const [isHovered, setIsHovered] = useState(false);
    const isEditingEnvironment = useBooleanState(false);

    const { copyToClipboard, wasJustCopied } = useCopyToClipboard(
        ApiDefinition.buildRequestUrl({
            baseUrl,
            path
        })
    );

    const pathParts = useMemo(() => {
        const elements: (ReactElement<any> | null)[] = [];
        path.forEach((part, i) => {
            visitDiscriminatedUnion(part)._visit({
                literal: (literal) => {
                    literal.value.split(/(?=\/)|(?<=\/)/).forEach((value, j) => {
                        if (value === "/") {
                            elements.push(
                                <span key={`separator-${i}-${j}`} className="text-(color:--grayscale-a9)">
                                    {"/"}
                                </span>
                            );
                        } else {
                            elements.push(
                                <span key={`part-${i}-${j}`} className="text-(color:--grayscale-a9) whitespace-nowrap">
                                    {value}
                                </span>
                            );
                        }
                    });
                },
                pathParameter: (pathParameter) => {
                    elements.push(
                        <span
                            key={`part-${i}`}
                            className="bg-(color:--accent-a3) text-(color:--accent-a11) rounded-1 whitespace-nowrap px-1"
                        >
                            :{pathParameter.value}
                        </span>
                    );
                },
                _other: noop
            });
        });
        return elements;
    }, [path]);

    // if the environment is hidden, but it contains a basepath, we need to show the basepath
    const environmentBasepath = useMemo(() => {
        const url = baseUrl ?? options?.find((option) => option.id === environmentId)?.baseUrl;
        if (url == null) {
            return undefined;
        }

        const sanitizedUrl = sanitizeUrl(url);
        if (!sanitizedUrl) {
            return undefined;
        }

        try {
            const parsedUrl = new URL(sanitizedUrl);
            return parsedUrl.pathname;
        } catch {
            return undefined;
        }
    }, [options, environmentId, baseUrl]);

    const environmentDropdownContent =
        showEnvironment && renderEnvironmentDropdown ? (
            <span className="whitespace-nowrap max-sm:hidden">
                {renderEnvironmentDropdown({
                    baseUrl,
                    environmentId,
                    options,
                    urlTextStyle: "text-(color:--grayscale-a11)",
                    protocolTextStyle: "text-(color:--grayscale-a9)",
                    isEditingEnvironment,
                    editable: true,
                    lang,
                    readonly
                })}
            </span>
        ) : showEnvironment && baseUrl ? (
            <span className="text-(color:--grayscale-a11) whitespace-nowrap max-sm:hidden">
                {removeTrailingSlash(baseUrl)}
            </span>
        ) : null;

    return (
        <FernTooltipProvider>
            <FernTooltip
                content={wasJustCopied && hideCopyButton ? t(lang).buttons.copied : undefined}
                open={wasJustCopied && hideCopyButton ? true : undefined}
            >
                <div
                    ref={composeRefs(ref, forwardedRef)}
                    className={cn("flex items-center gap-1 pr-2", className)}
                    onPointerEnter={() => setIsHovered(true)}
                    onPointerLeave={() => setIsHovered(false)}
                    onClick={() => {
                        if (hideCopyButton) {
                            void copyToClipboard?.();
                        }
                    }}
                >
                    <ApiMethodBadge method={method} />

                    <div className={cn("flex items-center")}>
                        <span
                            className={`rounded-3/2 inline-flex shrink items-center p-1 ${
                                hideCopyButton ? "hover:bg-(color:--grayscale-a3) cursor-pointer" : "cursor-default"
                            }`}
                        >
                            <span className="flex items-center">
                                <span
                                    className={cn("font-mono", {
                                        "text-xs": !large,
                                        "text-sm": large
                                    })}
                                >
                                    {environmentDropdownContent}
                                    {!showEnvironment && environmentBasepath && environmentBasepath !== "/" && (
                                        <span className="text-(color:--grayscale-a11)">
                                            {removeTrailingSlash(environmentBasepath)}
                                        </span>
                                    )}
                                    {pathParts}
                                </span>
                            </span>
                        </span>
                    </div>
                    {!hideCopyButton && (
                        <CopyToClipboardButton
                            className={isHovered ? "visible" : "invisible"}
                            content={() =>
                                ApiDefinition.buildRequestUrl({
                                    baseUrl,
                                    path
                                })
                            }
                            lang={lang}
                        />
                    )}
                </div>
            </FernTooltip>
        </FernTooltipProvider>
    );
});
