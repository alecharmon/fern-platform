"use client";

import type { FernUser as FernUserType } from "@fern-api/docs-auth";
import { fernUserAtom } from "@fern-docs/components/state/fern-user";
import { useLoggedIn } from "@fern-docs/components/state/logged-in";
import { useRoles } from "@fern-docs/components/state/roles";
import { useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

export function FernUser() {
    const setUser = useSetAtom(fernUserAtom);
    const isLoggedIn = useLoggedIn();
    const roles = useRoles();
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (isLoggedIn) {
            // Set initial user with roles from URL path immediately
            // This ensures role-based content is visible right away
            setUser({ roles });

            // Then fetch full user data from whoami endpoint for additional claims
            // (email, sub, playground state, etc.)
            if (!fetchedRef.current) {
                fetchedRef.current = true;
                fetch("/api/fern-docs/whoami")
                    .then((res) => {
                        if (res.ok) {
                            return res.json();
                        }
                        return null;
                    })
                    .then((data) => {
                        if (data?.user_info) {
                            const userInfo = data.user_info as FernUserType;
                            // Merge fetched user info with roles from URL path
                            // URL path roles take precedence as they're the source of truth for RBAC
                            setUser({
                                ...userInfo,
                                roles
                            });
                        }
                    })
                    .catch((err) => {
                        console.debug("[FernUser] Failed to fetch user info:", err);
                    });
            }
        } else {
            setUser(undefined);
            fetchedRef.current = false;
        }
    }, [isLoggedIn, roles, setUser]);

    return null;
}
