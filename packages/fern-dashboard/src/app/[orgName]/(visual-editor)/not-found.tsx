"use client";

import { useParams } from "next/navigation";

import ReturnHomeButton from "@/components/ReturnHomeButton";
import NotFoundContent from "@/components/docs-page/NotFoundContent";

export default function OrgNotFound() {
    const { orgName } = useParams();

    return (
        <div className="border-border mx-auto my-auto h-fit rounded-xl border bg-white p-8 dark:bg-black">
            <NotFoundContent>
                <p className="mb-4">
                    The requested organization <code>{orgName}</code> either doesn&apos;t exist or you don&apos;t have
                    permissions to view it.
                </p>
                <div className="font-normal">
                    <ReturnHomeButton />
                </div>
            </NotFoundContent>
        </div>
    );
}
