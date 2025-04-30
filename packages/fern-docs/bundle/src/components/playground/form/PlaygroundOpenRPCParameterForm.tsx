"use client";

import { FC, memo, useCallback, useEffect, useState } from "react";

import {
  ObjectProperty,
  TypeDefinition,
  TypeId,
  TypeReference,
} from "@fern-api/fdr-sdk/api-definition";
import { cn } from "@fern-docs/components";
import { useBooleanState } from "@fern-ui/react-commons";

import { withErrorBoundary } from "@/components/error-boundary";

import { castToArray, isExpandable } from "../utils";
import { PlaygroundTypeReferenceForm } from "./PlaygroundTypeReferenceForm";

interface PlaygroundOpenRPCParameterFormProps {
  id: string;
  index: number;
  property: ObjectProperty;
  onChange: (key: number, value: unknown) => void;
  value: unknown;
  expandByDefault?: boolean;
  types: Record<TypeId, TypeDefinition>;
  disabled?: boolean;
  defaultValue?: unknown;
}

const PlaygroundOpenRPCParameterFormInternal: FC<
  PlaygroundOpenRPCParameterFormProps
> = ({
  id,
  index,
  property,
  onChange,
  value,
  expandByDefault = true,
  types,
  disabled,
}) => {
  const handleChange = useCallback(
    (newValue: unknown) => {
      onChange(index, newValue);
    },
    [onChange, index]
  );

  const expandable = isExpandable(property.valueShape, value, types);
  const {
    // value: expanded,
    setTrue: setExpanded,
    // toggleValue: toggleExpanded,
  } = useBooleanState(!expandable || expandByDefault);

  useEffect(() => {
    if (!expandable) {
      setExpanded();
    }
  }, [expandable, setExpanded]);

  const [_isUnderStack, setIsUnderStack] = useState(false);
  const handleOpenStack = useCallback(() => setIsUnderStack(true), []);
  const handleCloseStack = useCallback(() => setIsUnderStack(false), []);

  return (
    <PlaygroundTypeReferenceForm
      id={id}
      property={property}
      shape={property.valueShape}
      onChange={handleChange}
      value={value}
      renderAsPanel={true}
      onOpenStack={handleOpenStack}
      onCloseStack={handleCloseStack}
      types={types}
      disabled={disabled}
    />
  );
};

export const PlaygroundOpenRPCParameterForm = withErrorBoundary(
  PlaygroundOpenRPCParameterFormInternal
);

interface PlaygroundOpenRPCParametersFormProps {
  id: string;
  properties: readonly ObjectProperty[];
  extraProperties: TypeReference | undefined;
  onChange: (value: unknown) => void;
  value: unknown;
  defaultValue?: unknown;
  indent?: boolean;
  types: Record<string, TypeDefinition>;
  disabled?: boolean;
}

export const PlaygroundOpenRPCParametersFormInternal =
  memo<PlaygroundOpenRPCParametersFormProps>((props) => {
    const {
      id,
      properties,
      onChange,
      value,
      indent = false,
      types,
      disabled,
    } = props;

    const onChangeOpenRPCParameter = useCallback(
      (index: number, newValue: unknown) => {
        onChange((oldValue: unknown) => {
          const oldArray = castToArray(oldValue);
          const newArray = [...oldArray];
          newArray[index] =
            typeof newValue === "function"
              ? newValue(newArray[index])
              : newValue;
          return newArray;
        });
      },
      [onChange]
    );

    return (
      <div
        className={cn("min-w-0 flex-1 shrink", {
          "border-border-default-soft border-l pl-4": indent,
        })}
      >
        {properties.length > 0 && (
          <ul className="list-none space-y-8">
            {properties.map((property, index) => {
              const childId =
                id.length > 0 ? `${id}.${property.key}` : property.key;
              return (
                <li
                  key={property.key}
                  className="relative -mx-4 px-4"
                  tabIndex={-1}
                >
                  <PlaygroundOpenRPCParameterForm
                    id={childId}
                    index={index}
                    property={property}
                    onChange={onChangeOpenRPCParameter}
                    value={castToArray(value)[index]}
                    types={types}
                    disabled={disabled}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  });

PlaygroundOpenRPCParametersFormInternal.displayName =
  "PlaygroundOpenRPCParametersFormInternal";

export const PlaygroundOpenRPCParametersForm = withErrorBoundary(
  PlaygroundOpenRPCParametersFormInternal,
  <div>Error rendering OpenRPC parameters form</div>
);
