"use client";

import { HttpOrWssOrGrpc } from "@fern-api/docs-utils";
import { APIV1Read } from "@fern-api/fdr-sdk";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { sanitizeUrl, visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { HttpMethodBadge } from "@fern-docs/components/badges";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useBooleanState, useCopyToClipboard } from "@fern-ui/react-commons";
import { composeRefs } from "@radix-ui/react-compose-refs";
import React, { PropsWithChildren, ReactElement, useMemo, useRef, useState } from "react";
import { noop } from "ts-essentials";

import { MaybeEnvironmentDropdown } from "../MaybeEnvironmentDropdown";

export declare namespace EndpointUrl {
    export type Props = React.PropsWithChildren<{
        path: ApiDefinition.PathPart[];
        method: HttpOrWssOrGrpc;
        baseUrl?: string;
        environmentId?: ApiDefinition.EnvironmentId;
        options?: APIV1Read.Environment[];
        showEnvironment?: boolean;
        hideCopyButton?: boolean;
        large?: boolean;
        className?: string;
    }>;
}

// TODO: this component needs a refresh
export const EndpointUrl = React.forwardRef<HTMLDivElement, PropsWithChildren<EndpointUrl.Props>>(function EndpointUrl(
    { path, method, baseUrl, environmentId, large, className, showEnvironment, hideCopyButton, options },
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

    return (
        <FernTooltipProvider>
            <FernTooltip
                content={wasJustCopied && hideCopyButton ? "Copied!" : undefined}
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
                    <HttpMethodBadge method={method} />

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
                                    {showEnvironment && (
                                        <span className="whitespace-nowrap max-sm:hidden">
                                            <MaybeEnvironmentDropdown
                                                baseUrl={baseUrl}
                                                environmentId={environmentId}
                                                options={options}
                                                urlTextStyle="text-(color:--grayscale-a11)"
                                                protocolTextStyle="text-(color:--grayscale-a9)"
                                                isEditingEnvironment={isEditingEnvironment}
                                                editable
                                            />
                                        </span>
                                    )}
                                    {!showEnvironment && environmentBasepath && environmentBasepath !== "/" && (
                                        <span className="text-(color:--grayscale-a11)">{environmentBasepath}</span>
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
                        />
                    )}
                </div>
            </FernTooltip>
        </FernTooltipProvider>
    );
});
