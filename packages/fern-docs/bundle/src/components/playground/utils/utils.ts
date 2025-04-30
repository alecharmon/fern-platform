import { uniqBy } from "es-toolkit/array";

import {
  HttpRequestBodyShape,
  TypeDefinition,
  TypeReference,
  TypeShapeOrReference,
  unwrapObjectType,
  unwrapReference,
} from "@fern-api/fdr-sdk/api-definition";
import {
  isPlainObject,
  visitDiscriminatedUnion,
} from "@fern-api/ui-core-utils";

export function castToArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  // Handle objects with numeric keys as arrays
  if (isPlainObject(value)) {
    const obj = castToRecord(value);
    const keys = Object.keys(obj);

    // Check if all keys are numeric indices
    const allNumericKeys = keys.every((key) => /^\d+$/.test(key));

    if (allNumericKeys && keys.length > 0) {
      // Convert to array by creating an array of the right length
      // and filling it with values at the correct indices
      const maxIndex = Math.max(...keys.map((k) => parseInt(k, 10)));
      const result = new Array(maxIndex + 1);

      for (const key of keys) {
        const index = parseInt(key, 10);
        result[index] = obj[key];
      }

      return result;
    }
  }

  return [];
}

export function castToRecord(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    return {};
  }
  return value;
}

export function isExpandable(
  valueShape: TypeShapeOrReference,
  currentValue: unknown,
  types: Record<string, TypeDefinition>
): boolean {
  return visitDiscriminatedUnion(
    unwrapReference(valueShape, types).shape,
    "type"
  )._visit<boolean>({
    object: () => false,
    discriminatedUnion: () => false,
    undiscriminatedUnion: () => false,
    enum: () => false,
    list: () => Array.isArray(currentValue) && currentValue.length > 0,
    set: () => Array.isArray(currentValue) && currentValue.length > 0,
    map: () =>
      isPlainObject(currentValue) && Object.keys(currentValue).length > 0,
    unknown: () => false,
    _other: () => false,
    primitive: () => false,
    literal: () => false,
  });
}

export function hasRequiredFields(
  bodyShape: HttpRequestBodyShape | TypeShapeOrReference,
  types: Record<string, TypeDefinition>
): boolean {
  if (bodyShape.type === "formData") {
    return bodyShape.fields.some((field) =>
      visitDiscriminatedUnion(field, "type")._visit<boolean>({
        file: (file) => !file.isOptional,
        files: (files) => !files.isOptional,
        property: (prop) => hasRequiredFields(prop.valueShape, types),
        _other: () => false,
      })
    );
  } else if (bodyShape.type === "bytes") {
    return !bodyShape.isOptional;
  } else {
    const unwrapped = unwrapReference(bodyShape, types);
    if (unwrapped.isOptional) {
      return false;
    }

    return visitDiscriminatedUnion(unwrapped.shape)._visit<boolean>({
      primitive: () => true,
      literal: () => true,
      object: (object) =>
        unwrapObjectType(object, types).properties.some((property) =>
          hasRequiredFields(property.valueShape, types)
        ),
      undiscriminatedUnion: () => true,
      discriminatedUnion: () => true,
      enum: () => true,
      list: () => true,
      set: () => true,
      map: () => true,
      unknown: () => true,
      _other: () => true,
    });
  }
}

export function hasOptionalFields(
  bodyShape: HttpRequestBodyShape | TypeReference,
  types: Record<string, TypeDefinition>
): boolean {
  return !hasRequiredFields(bodyShape, types);
}

export const ENUM_RADIO_BREAKPOINT = 5;

export function shouldRenderInline(
  typeReference: TypeShapeOrReference,
  types: Record<string, TypeDefinition>
): boolean {
  const unwrapped = unwrapReference(typeReference, types);
  if (unwrapped.isOptional) {
    return false;
  }
  return visitDiscriminatedUnion(unwrapped.shape, "type")._visit({
    primitive: () => true,
    literal: () => true,
    object: () => false,
    map: () => false,
    undiscriminatedUnion: () => false,
    discriminatedUnion: () => false,
    enum: (_enum) => true,
    list: () => false,
    set: () => false,
    unknown: () => false,
    _other: () => false,
  });
}

export function uniqueFiles(files: File[]): readonly File[] | undefined {
  return uniqBy(files, (f) => `${f.webkitRelativePath}/${f.name}/${f.size}`);
}

export function isValidFile(file: any): file is File {
  return (
    file != null &&
    typeof file === "object" &&
    "name" in file &&
    "size" in file &&
    "type" in file
  );
}
