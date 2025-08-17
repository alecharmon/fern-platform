import { forwardRef } from "react";

import { Button, FernInput, FernInputProps } from "@fern-docs/components";

export const IdempotentInputGroup = forwardRef<
  HTMLInputElement,
  FernInputProps
>((props, forwardedRef) => {
  function generateIdempotencyKey() {
    return crypto.randomUUID();
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
