"use client";

import { ReactElement, useMemo } from "react";

import {
  TypeDefinition,
  TypeShape,
  unwrapObjectType,
} from "@fern-api/fdr-sdk/api-definition";

import { PlaygroundOpenRPCParametersForm } from "./PlaygroundOpenRPCParameterForm";

interface PlaygroundOpenRPCParamsFormProps {
  id: string;
  shape: TypeShape.Object_;
  onChange: (value: unknown) => void;
  value: unknown;
  indent?: boolean;
  types: Record<string, TypeDefinition>;
  disabled?: boolean;
  defaultValue?: unknown;
}

export function PlaygroundOpenRPCParamsForm({
  id,
  shape,
  onChange,
  value,
  types,
}: PlaygroundOpenRPCParamsFormProps): ReactElement<any> {
  const { properties, extraProperties } = useMemo(
    () => unwrapObjectType(shape, types),
    [shape, types]
  );
  return (
    <PlaygroundOpenRPCParametersForm
      id={id}
      properties={properties}
      extraProperties={extraProperties}
      onChange={onChange}
      value={value}
      types={types}
    />
  );
}
