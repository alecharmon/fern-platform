"use client";

import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";

export declare namespace NavbarSectionTitle {
    export interface Props {
        title: string;
    }
}

export const NavbarSectionTitle = ({ title }: NavbarSectionTitle.Props) => {
    const [isCollapsed] = useIsSidebarCollapsed();

    if (isCollapsed) {
        return (
            <div className="my-3 hidden md:flex">
                <div className="h-px w-full bg-gray-700" />
            </div>
        );
    }

    return <div className="my-3 hidden text-xs font-bold md:flex">{title}</div>;
};
