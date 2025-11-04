import type { APIV1Read, FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { sanitizeUrl } from "@fern-api/ui-core-utils";
import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernInput } from "@fern-docs/components/FernInput";
import { FernTooltip } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import type { useBooleanState } from "@fern-ui/react-commons";
import { useAtom } from "jotai";
import React, { type ReactElement, useEffect, useState } from "react";
import { useApiDefinitionIdFromContext } from "@/contexts/ApiDefinitionIdContext";
import { SELECTED_ENVIRONMENT_ID_ATOM, useSelectedEnvironmentUrlAtom } from "@/state/environment";

interface MaybeEnvironmentDropdownProps {
    baseUrl?: string;
    environmentId: APIV1Read.EnvironmentId | undefined;
    urlTextStyle?: string;
    protocolTextStyle?: string;
    small?: boolean;
    options?: APIV1Read.Environment[];
    editable?: boolean;
    isEditingEnvironment: useBooleanState.Return;
    apiDefinitionId?: FdrAPI.ApiDefinitionId;
    lang: string;
}

export function MaybeEnvironmentDropdown({
    baseUrl,
    environmentId,
    urlTextStyle,
    protocolTextStyle,
    small,
    options,
    editable,
    isEditingEnvironment,
    apiDefinitionId,
    lang
}: MaybeEnvironmentDropdownProps): ReactElement<any> | null {
    const idFromContext = useApiDefinitionIdFromContext();
    const id = apiDefinitionId ?? idFromContext;
    const [selectedEnvironmentId, setSelectedEnvironmentId] = useAtom(SELECTED_ENVIRONMENT_ID_ATOM);
    const selectedEnvironmentUrlAtom = useSelectedEnvironmentUrlAtom(id);
    const [_selectedEnvironmentUrl, setSelectedEnvironmentUrl] = useAtom(selectedEnvironmentUrlAtom);
    const [inputValue, setInputValue] = useState<string | undefined>(undefined);
    const [initialState, setInitialState] = useState<string | undefined>(undefined);

    useEffect(() => {
        setInputValue(sanitizeUrl(baseUrl));
        setInitialState(sanitizeUrl(baseUrl));
    }, [baseUrl]);

    // if we have selected a new environment id, update the selected url to match
    useEffect(() => {
        if (selectedEnvironmentId) {
            const envBaseUrl = options?.find((option) => option.id === selectedEnvironmentId)?.baseUrl ?? undefined;
            setSelectedEnvironmentUrl(envBaseUrl);
        }
    }, [selectedEnvironmentId, options, setSelectedEnvironmentUrl]);

    // input value is for editing and validation
    const parsedInputValue = safeParseUrl(inputValue);
    const isValidInput =
        inputValue != null && inputValue !== "" && parsedInputValue?.host != null && parsedInputValue?.protocol != null;

    // url is for splitting into parts
    const url = baseUrl && safeParseUrl(sanitizeUrl(baseUrl) ?? "");
    const urlProtocol = url ? url.protocol : "";
    const fullyQualifiedDomainAndBasePath = url
        ? url.pathname != null && url.pathname !== "/"
            ? `${url.host}${url.pathname}`
            : url.host
        : "";

    return (
        <>
            {isEditingEnvironment.value ? (
                <span key="url" className="inline-flex whitespace-nowrap font-mono max-sm:hidden">
                    <FernInput
                        autoFocus={isEditingEnvironment.value}
                        size={inputValue?.length ?? 0}
                        placeholder={inputValue}
                        value={inputValue}
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        onBlur={(e) => {
                            if (isValidInput) {
                                isEditingEnvironment.setFalse();
                                setSelectedEnvironmentId(undefined);
                                setSelectedEnvironmentUrl(inputValue);
                            } else {
                                e.preventDefault();
                                e.stopPropagation();
                                setInputValue(initialState);
                                isEditingEnvironment.setFalse();
                            }
                        }}
                        onValueChange={(value) => {
                            setInputValue(value);
                        }}
                        onKeyDownCapture={(e) => {
                            if (e.key === "Enter" && isValidInput) {
                                isEditingEnvironment.setFalse();
                                setSelectedEnvironmentId(undefined);
                                setSelectedEnvironmentUrl(inputValue);
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                setInputValue(initialState);
                                isEditingEnvironment.setFalse();
                            }
                        }}
                        className={cn("p-0", isValidInput ? "" : "error", "h-auto w-fit", "flex flex-col")}
                        inputClassName={cn(
                            "px-1",
                            "py-0.5",
                            "h-auto w-fit",
                            "font-mono",
                            small ? "text-xs" : "text-sm"
                        )}
                    />
                </span>
            ) : (
                <FernTooltip content={<span>{t(lang).playground.doubleClickToEdit}</span>}>
                    <span className="max-sm:hidden" style={{ pointerEvents: "auto" }}>
                        {options && options.length > 1 ? (
                            <FernDropdown
                                key="selectedEnvironment-selector"
                                options={options.map((env) => ({
                                    value: env.id,
                                    label: env.id,
                                    type: "value"
                                }))}
                                onValueChange={(value) => {
                                    setSelectedEnvironmentId(value);
                                    // useEffect updates the URL
                                }}
                                value={selectedEnvironmentId ?? environmentId}
                                lang={lang}
                            >
                                <FernButton
                                    style={{ pointerEvents: "auto" }}
                                    className={cn("h-auto px-1 py-0", small && "rounded-1")}
                                    text={
                                        <span key="protocol" className="whitespace-nowrap max-sm:hidden">
                                            <span className={protocolTextStyle}>{`${urlProtocol}//`}</span>
                                            <span className={urlTextStyle}>
                                                {fullyQualifiedDomainAndBasePath ?? ""}
                                            </span>
                                        </span>
                                    }
                                    size={small ? "small" : "normal"}
                                    variant="outlined"
                                    mono={true}
                                    onDoubleClick={
                                        editable
                                            ? () => {
                                                  setInitialState(inputValue);
                                                  isEditingEnvironment.setTrue();
                                              }
                                            : () => undefined
                                    }
                                />
                            </FernDropdown>
                        ) : (
                            <span key="url" className="whitespace-nowrap font-mono max-sm:hidden">
                                {editable ? (
                                    <span
                                        className={cn(
                                            urlTextStyle,
                                            "p-0",
                                            small ? "text-xs" : "text-sm",
                                            "hover:shadow-lg"
                                        )}
                                        onDoubleClick={
                                            editable
                                                ? () => {
                                                      setInitialState(inputValue);
                                                      isEditingEnvironment.setTrue();
                                                  }
                                                : () => undefined
                                        }
                                    >
                                        {`${urlProtocol}//${fullyQualifiedDomainAndBasePath}`}
                                    </span>
                                ) : (
                                    <>
                                        <span className={cn(protocolTextStyle, small ? "text-xs" : "text-sm")}>
                                            {`${urlProtocol}//`}
                                        </span>
                                        <span className={urlTextStyle}>{fullyQualifiedDomainAndBasePath}</span>
                                    </>
                                )}
                            </span>
                        )}
                    </span>
                </FernTooltip>
            )}
        </>
    );
}

const safeParseUrl = (url: string | undefined): URL | null => {
    return url
        ? (() => {
              try {
                  return new URL(url);
              } catch {
                  return null;
              }
          })()
        : null;
};
