"use client";

import { createContext, type ReactNode, useContext } from "react";

interface InternalAuthState {
    email: string | undefined;
}

const InternalAuthContext = createContext<InternalAuthState>({
    email: undefined
});

export function useInternalAuth(): InternalAuthState {
    return useContext(InternalAuthContext);
}

interface InternalAuthProviderProps {
    children: ReactNode;
    email: string | undefined;
}

export function InternalAuthProvider({ children, email }: InternalAuthProviderProps) {
    return <InternalAuthContext value={{ email }}>{children}</InternalAuthContext>;
}
