"use client";

import { useEffect, useState } from "react";

import { LAST_USED_LOGIN_KEY } from "@/components/auth/LoginButton";
import { getLoginProviderLabel } from "@/utils/getLoginProvider";

interface SignedInTextProps {
    email: string;
}

export function SignedInText({ email }: SignedInTextProps) {
    const [providerLabel, setProviderLabel] = useState<string | undefined>(undefined);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
        try {
            const lastUsed = localStorage.getItem(LAST_USED_LOGIN_KEY);
            if (lastUsed != null) {
                setProviderLabel(getLoginProviderLabel(lastUsed));
            }
        } catch {}
    }, []);

    if (!hasMounted) {
        return (
            <p>
                Signed in as <b>{email}</b>
            </p>
        );
    }

    return (
        <p>
            {providerLabel != null ? (
                <>
                    Signed in via <b>{providerLabel}</b> as{" "}
                </>
            ) : (
                "Signed in as "
            )}
            <b>{email}</b>
        </p>
    );
}
