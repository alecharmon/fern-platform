"use client";

import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { t } from "@fern-docs/i18n";
import { ChevronDown, LogInIcon } from "lucide-react";

export interface AuthMethodOption {
    id: string;
    name: string;
    loginUrl: string;
    returnToQueryParam: string;
}

// Map ButtonLink sizes to FernButton sizes
const mapSize = (size?: "xs" | "sm" | "lg"): "small" | "normal" | "large" | undefined => {
    if (!size) {
        return undefined;
    }
    switch (size) {
        case "xs":
            return "small";
        case "sm":
            return "normal";
        case "lg":
            return "large";
    }
};

export function LoginButtonDropdown({
    authMethods,
    size,
    className,
    showIcon = false,
    lang
}: {
    authMethods: AuthMethodOption[];
    size?: "xs" | "sm" | "lg";
    className?: string;
    showIcon?: boolean;
    lang: string;
}) {
    const dropdownOptions: FernDropdown.ValueOption[] = authMethods.map((method) => ({
        type: "value" as const,
        value: method.id,
        label: method.name,
        href: method.loginUrl
    }));

    return (
        <FernDropdown
            options={dropdownOptions}
            onValueChange={(value) => {
                const method = authMethods.find((m) => m.id === value);
                if (method) {
                    window.location.href = method.loginUrl;
                }
            }}
            lang={lang}
            side="bottom"
            align="end"
        >
            <FernButton
                variant="outlined"
                size={mapSize(size)}
                className={className}
                icon={showIcon ? <LogInIcon /> : undefined}
                rightIcon={<ChevronDown className="size-4" />}
            >
                {t(lang).auth.login}
            </FernButton>
        </FernDropdown>
    );
}
