import React, { ReactElement, useEffect, useState } from "react";

import { useAtom } from "jotai";
import { URL } from "url";

import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { sanitizeUrl } from "@fern-api/ui-core-utils";
import {
  FernButton,
  FernDropdown,
  FernInput,
  FernTooltip,
  cn,
} from "@fern-docs/components";
import { useBooleanState } from "@fern-ui/react-commons";

import {
  SELECTED_ENVIRONMENT_ID_ATOM,
  SELECTED_ENVIRONMENT_URL_ATOM,
} from "@/state/environment";

interface MaybeEnvironmentDropdownProps {
  baseUrl?: string;
  environmentId: APIV1Read.EnvironmentId | undefined;
  urlTextStyle?: string;
  protocolTextStyle?: string;
  small?: boolean;
  // environmentFilters?: APIV1Read.EnvironmentId[];
  options?: APIV1Read.Environment[];
  editable?: boolean;
  isEditingEnvironment: useBooleanState.Return;
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
}: MaybeEnvironmentDropdownProps): ReactElement<any> | null {
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useAtom(
    SELECTED_ENVIRONMENT_ID_ATOM
  );
  const [selectedEnvironmentUrl, setSelectedEnvironmentUrl] = useAtom(
    SELECTED_ENVIRONMENT_URL_ATOM
  );
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);
  const [initialState, setInitialState] = useState<string | undefined>(
    undefined
  );

  // if we have selected a new environment id, update the selected url to match
  useEffect(() => {
    if (selectedEnvironmentId) {
      const envBaseUrl =
        options?.find((option) => option.id === selectedEnvironmentId)
          ?.baseUrl ?? undefined;
      setSelectedEnvironmentUrl(envBaseUrl);
    }
  }, [selectedEnvironmentId, options, setSelectedEnvironmentUrl]);

  // const environmentIds = environmentFilters
  //     ? environmentFilters.filter((environmentFilter) => allEnvironmentIds.includes(environmentFilter))
  //     : allEnvironmentIds;

  // useEffect(() => {
  //     if (environmentFilters && environmentId && !environmentFilters.includes(environmentId)) {
  //         setSelectedEnvironmentId(environmentId);
  //     }
  // }, [environmentFilters, environmentId, setSelectedEnvironmentId]);

  const preParsedUrl = selectedEnvironmentUrl ?? baseUrl;
  const url = preParsedUrl && safeParseUrl(sanitizeUrl(preParsedUrl) ?? "");

  // TODO: clean up this component
  useEffect(() => {
    if (
      !!url &&
      url.host &&
      url.host !== "" &&
      url.protocol &&
      url.protocol !== ""
    ) {
      setInputValue(preParsedUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEnvironmentUrl]);

  const parsedInputValue = safeParseUrl(inputValue);
  const isValidInput =
    inputValue != null &&
    inputValue !== "" &&
    parsedInputValue?.host != null &&
    parsedInputValue?.protocol != null;

  const urlProtocol = url ? url.protocol : "";
  const fullyQualifiedDomainAndBasePath = url
    ? url.pathname != null && url.pathname !== "/"
      ? `${url.host}${url.pathname}`
      : url.host
    : "";

  return (
    <>
      {isEditingEnvironment.value ? (
        <span
          key="url"
          className="inline-flex whitespace-nowrap font-mono max-sm:hidden"
        >
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
                if (selectedEnvironmentUrl) {
                  setInputValue(selectedEnvironmentUrl);
                }
                isEditingEnvironment.setFalse();
              } else {
                e.preventDefault();
                e.stopPropagation();
                setInputValue(initialState);
                isEditingEnvironment.setFalse();
              }
            }}
            onValueChange={(value) => {
              const parsedValue = safeParseUrl(value);
              if (
                value === "" ||
                value == null ||
                parsedValue?.host == null ||
                parsedValue?.protocol == null
              ) {
                setInputValue(value);
              } else {
                setInputValue(value);
              }
            }}
            onKeyDownCapture={(e) => {
              if (e.key === "Enter" && isValidInput) {
                if (selectedEnvironmentUrl) {
                  setInputValue(selectedEnvironmentUrl);
                }
                isEditingEnvironment.setFalse();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setInputValue(initialState);
                isEditingEnvironment.setFalse();
              }
            }}
            className={cn(
              "p-0",
              isValidInput ? "" : "error",
              "h-auto",
              "flex flex-col"
            )}
            inputClassName={cn(
              "px-1",
              "py-0.5",
              "h-auto",
              "font-mono",
              small ? "text-xs" : "text-sm"
            )}
          />
        </span>
      ) : (
        <FernTooltip content={<span>Double click to edit</span>}>
          <span className="max-sm:hidden" style={{ pointerEvents: "auto" }}>
            {options && options.length > 1 ? (
              <FernDropdown
                key="selectedEnvironment-selector"
                options={options.map((env) => ({
                  value: env.id,
                  label: env.id,
                  type: "value",
                }))}
                onValueChange={(value) => {
                  setSelectedEnvironmentId(value);
                  // useEffect updates the URL
                }}
                value={selectedEnvironmentId ?? environmentId}
              >
                <FernButton
                  style={{ pointerEvents: "auto" }}
                  className={cn("h-auto px-1 py-0", small && "rounded-1")}
                  text={
                    <span
                      key="protocol"
                      className="whitespace-nowrap max-sm:hidden"
                    >
                      <span
                        className={protocolTextStyle}
                      >{`${urlProtocol}//`}</span>
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
              <span
                key="url"
                className="whitespace-nowrap font-mono max-sm:hidden"
              >
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
                    <span
                      className={cn(
                        protocolTextStyle,
                        small ? "text-xs" : "text-sm"
                      )}
                    >
                      {`${urlProtocol}//`}
                    </span>
                    <span className={urlTextStyle}>
                      {fullyQualifiedDomainAndBasePath}
                    </span>
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
