import { Button } from "@fern-docs/components/button";
import { FernInput, FernInputProps } from "@fern-docs/components/FernInput";
import { randomBytes } from "crypto-browserify";
import { forwardRef } from "react";

export const IdempotentInputGroup = forwardRef<HTMLInputElement, FernInputProps>((props, forwardedRef) => {
    function generateIdempotencyKey() {
        const bytes = randomBytes(16);
        const hex = bytes.toString("hex");
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
    }
    return (
        <FernInput
            ref={forwardedRef}
            {...props}
            rightElement={
                <Button variant="ghostMinimal" onClick={() => props.onValueChange?.(generateIdempotencyKey())}>
                    Generate
                </Button>
            }
        />
    );
});

IdempotentInputGroup.displayName = "IdempotentInputGroup";
