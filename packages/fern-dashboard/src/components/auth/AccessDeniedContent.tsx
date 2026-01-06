import ShieldExclamationIcon from "@heroicons/react/24/outline/ShieldExclamationIcon";
import type React from "react";

import { LogoutButton } from "./LogoutButton";

export interface AccessDeniedContentProps {
    /**
     * Custom message to display. Defaults to generic access denied message.
     */
    message?: React.ReactNode;
}

export default function AccessDeniedContent({ message }: AccessDeniedContentProps) {
    return (
        <div className="mx-auto flex w-[550px] flex-col items-center justify-center gap-8">
            <ShieldExclamationIcon className="size-18 text-gray-500" />

            <div className="flex flex-col text-center">
                <div className="mb-2 text-2xl font-bold">Access Denied</div>
                <p className="text-muted-foreground text-sm">
                    {message ?? "You don't have permission to access this resource."}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <LogoutButton />
            </div>
        </div>
    );
}
