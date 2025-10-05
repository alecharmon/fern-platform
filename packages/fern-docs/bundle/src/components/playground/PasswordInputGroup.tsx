import { forwardRef } from "react";

import { Eye, Lock } from "lucide-react";

import { FernButton } from "@fern-docs/components/FernButton";
import { FernInput, type FernInputProps } from "@fern-docs/components/FernInput";
import { useBooleanState } from "@fern-ui/react-commons";

export const PasswordInputGroup = forwardRef<HTMLInputElement, FernInputProps>((props, forwardedRef) => {
    const showPassword = useBooleanState(false);
    return (
        <FernInput
            ref={forwardedRef}
            leftIcon={<Lock className="size-icon" />}
            {...props}
            type={showPassword.value ? "text" : "password"}
            rightElement={
                typeof props.value === "string" && props.value.length > 0 ? (
                    <FernButton variant="minimal" icon={<Eye />} onClick={showPassword.toggleValue} />
                ) : (
                    props.rightElement
                )
            }
        />
    );
});

PasswordInputGroup.displayName = "PasswordInputGroup";
