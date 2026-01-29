import { Button } from "@fern-docs/components/button";
import { FernInput, type FernInputProps } from "@fern-docs/components/FernInput";
import { t } from "@fern-docs/i18n";
import { forwardRef } from "react";

export const IdempotentInputGroup = forwardRef<HTMLInputElement, FernInputProps>((props, forwardedRef) => {
    function generateIdempotencyKey() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
    }
    return (
        <FernInput
            ref={forwardedRef}
            {...props}
            rightElement={
                <Button variant="ghostMinimal" onClick={() => props.onValueChange?.(generateIdempotencyKey())}>
                    {t(props.lang).buttons.generate}
                </Button>
            }
            lang={props.lang}
        />
    );
});

IdempotentInputGroup.displayName = "IdempotentInputGroup";
