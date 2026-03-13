"use client";

import Link from "next/link";

import { OrgAlert, type OrgAlertProps } from "./OrgAlert";

type LinkOrgAlertProps = Omit<OrgAlertProps, "onAction" | "loading"> & {
    href: string;
};

export function LinkOrgAlert({ href, ...props }: LinkOrgAlertProps) {
    return (
        <Link href={href}>
            <OrgAlert {...props} />
        </Link>
    );
}
