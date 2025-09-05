import { forwardRef } from "react";

import { randomUUID } from "crypto-browserify";

import { Button, FernInput, FernInputProps } from "@fern-docs/components";

export const IdempotentInputGroup = forwardRef<
  HTMLInputElement,
  FernInputProps
>((props, forwardedRef) => {
  function generateIdempotencyKey() {
    return randomUUID();
  }
  return (
    <FernInput
      ref={forwardedRef}
      {...props}
      rightElement={
        <Button
          variant="ghostMinimal"
          onClick={() => props.onValueChange?.(generateIdempotencyKey())}
        >
          Generate
        </Button>
      }
    />
  );
});

IdempotentInputGroup.displayName = "IdempotentInputGroup";
