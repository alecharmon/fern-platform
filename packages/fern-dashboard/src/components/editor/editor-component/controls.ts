import { AttributeValue } from "../editor-mdx-renderer/types";

// Base Control class
export abstract class Control {
  abstract readonly type: string;

  abstract getDefaultValue(): AttributeValue;
}

// SelectControl class
export class SelectControl extends Control {
  readonly type = "select" as const;
  readonly options: readonly string[];
  readonly defaultValue?: string;

  constructor(params: { options: readonly string[]; defaultValue?: string }) {
    super();
    this.options = params.options;
    this.defaultValue = params.defaultValue;
  }

  getDefaultValue(): AttributeValue {
    return {
      type: "string",
      value: this.defaultValue || "",
    };
  }
}

// TextInputControl class
export class TextInputControl extends Control {
  readonly type = "text" as const;
  readonly placeholder?: string;
  readonly defaultValue?: string;

  constructor(params?: { placeholder?: string; defaultValue?: string }) {
    super();
    this.placeholder = params?.placeholder;
    this.defaultValue = params?.defaultValue;
  }

  getDefaultValue(): AttributeValue {
    return {
      type: "string",
      value: this.defaultValue || "",
    };
  }
}

// IntegerInputControl class
export class IntegerInputControl extends Control {
  readonly type = "integer" as const;
  readonly placeholder?: string;
  readonly defaultValue?: number;
  readonly min?: number;
  readonly max?: number;

  constructor(params?: {
    placeholder?: string;
    defaultValue?: number;
    min?: number;
    max?: number;
  }) {
    super();
    this.placeholder = params?.placeholder;
    this.defaultValue = params?.defaultValue;
    this.min = params?.min;
    this.max = params?.max;
  }

  getDefaultValue(): AttributeValue {
    return {
      type: "value",
      rawStringValue:
        this.defaultValue !== undefined ? String(this.defaultValue) : "",
    };
  }
}

// CheckboxControl class for boolean values
export class CheckboxControl extends Control {
  readonly type = "checkbox" as const;
  readonly defaultValue?: boolean;
  readonly label?: string;

  constructor(params?: { defaultValue?: boolean; label?: string }) {
    super();
    this.defaultValue = params?.defaultValue;
    this.label = params?.label;
  }

  getDefaultValue(): AttributeValue {
    return {
      type: "value",
      rawStringValue:
        this.defaultValue !== undefined ? String(this.defaultValue) : "",
    };
  }
}

// Generic attribute config type
export type AttributeConfig<
  T extends Record<string, Control> = Record<string, Control>,
> = T;

// Type to map attribute config to values
export type AttributeValues<T extends AttributeConfig> = {
  [K in keyof T]: AttributeValue;
};

// Utility type for creating strongly-typed attribute configs
export type CreateAttributeConfig<T extends AttributeConfig> = T;

// Helper to create attribute config with type inference
export function createAttributeConfig<T extends AttributeConfig>(config: T): T {
  return config;
}
