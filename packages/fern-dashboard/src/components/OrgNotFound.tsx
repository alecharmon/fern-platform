"use client";

import { useParams } from "next/navigation";

import NotFoundContent from "@/components/docs-page/NotFoundContent";
import ReturnHomeButton from "@/components/ReturnHomeButton";

export function OrgNotFound() {
    const { orgName } = useParams();

    return (
        <div className="flex flex-1 items-center justify-center">
            <div className="flex justify-center items-center mx-2 w-full h-full rounded-t-xl bg-white p-8 dark:bg-black">
                <NotFoundContent>
                    <p className="mb-4">
                        The requested organization <code>{orgName}</code> either doesn&apos;t exist or you don&apos;t
                        have permissions to view it.
                    </p>
                    <div className="font-normal">
                        <ReturnHomeButton />
                    </div>
                </NotFoundContent>
            </div>
        </div>
    );
}
