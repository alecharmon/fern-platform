"use client";

import { Building2 } from "lucide-react";
import { useState } from "react";

import { CreateOrganizationModal } from "@/components/auth/CreateOrganizationModal";
import { HeaderLinkButton } from "@/components/layout/HeaderLinkButton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface CreateDropdownProps {
    accessToken: string;
}

export function CreateDropdown({ accessToken }: CreateDropdownProps) {
    const [showOrgModal, setShowOrgModal] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div>
                        <HeaderLinkButton text="Create" href="#" onClick={() => {}} />
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={8} className="min-w-[200px]">
                    <DropdownMenuItem onClick={() => setShowOrgModal(true)}>
                        <Building2 />
                        Organization
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <CreateOrganizationModal accessToken={accessToken} open={showOrgModal} onOpenChange={setShowOrgModal} />
        </>
    );
}
