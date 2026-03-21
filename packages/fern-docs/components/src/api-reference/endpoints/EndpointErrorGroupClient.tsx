"use client";

import type { ErrorResponse } from "@fern-api/fdr-sdk/api-definition";
import type React from "react";
import { FernCollapse } from "../../FernCollapse";

import { useEndpointContext } from "./EndpointContext";
import { EndpointErrorClient } from "./EndpointErrorClient";

export function EndpointErrorGroupClient({
    errors
}: {
    errors: {
        children: React.ReactNode;
        data: ErrorResponse;
    }[];
}) {
    const { selectedError, setSelectedError } = useEndpointContext();

    return (
        <div className="border-border-default rounded-3 flex flex-col overflow-visible border">
            {errors.map((error, idx) => {
                const isSelected = selectedError != null && isErrorEqual(error.data, selectedError);
                return (
                    <EndpointErrorClient
                        key={idx}
                        error={error.data}
                        isFirst={idx === 0}
                        isLast={idx === (errors?.length ?? 0) - 1}
                        isSelected={isSelected}
                        onClick={(event) => {
                            event.stopPropagation();
                            if (!isSelected) {
                                setSelectedError(error.data);
                            }
                        }}
                        onClose={
                            isSelected
                                ? (event) => {
                                      event.stopPropagation();
                                      setSelectedError(undefined);
                                  }
                                : undefined
                        }
                        availability={error.data.availability}
                    >
                        <FernCollapse open={isSelected} className="w-full">
                            {error.children}
                        </FernCollapse>
                    </EndpointErrorClient>
                );
            })}
        </div>
    );
}

function isErrorEqual(a: ErrorResponse, b: ErrorResponse): boolean {
    return (
        a.statusCode === b.statusCode &&
        (a.name != null && b.name != null ? a.name === b.name : a.name == null && b.name == null)
    );
}
