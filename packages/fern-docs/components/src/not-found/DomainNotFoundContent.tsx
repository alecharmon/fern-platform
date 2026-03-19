"use client";

import { useEffect, useState } from "react";
import { Button } from "../FernButtonV2";
import { EmptyStateIcon } from "./EmptyStateIcon";

export function DomainNotFoundContent() {
    const [isLocalhost, setIsLocalhost] = useState(false);

    useEffect(() => {
        console.error("Error: Host not found. Use /api/fern-docs/preview?host= to point this domain at a host.");
        const hostname = window.location.hostname;
        const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
        setIsLocalhost(isLocal);
    }, []);

    if (isLocalhost) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-8">
                <div className="flex max-w-[500px] flex-col items-center gap-6">
                    <EmptyStateIcon />
                    <p className="text-(color:--grayscale-a11) text-[1.0625rem] leading-relaxed">
                        Please restart fern docs dev
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
            <div className="flex max-w-[500px] flex-col items-center gap-6">
                <EmptyStateIcon />
                <div>
                    <h1 className="text-(color:--grayscale-12) mb-2 text-[1.75rem] font-bold">
                        This domain can be yours
                    </h1>
                    <p className="text-(color:--grayscale-a11) text-base leading-relaxed">
                        No Fern docs site is connected here yet.
                        <br />
                        Create one and claim it in minutes.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" asChild>
                        <a href="https://buildwithfern.com/learn/docs/preview-publish/setting-up-your-domain">
                            Read more
                        </a>
                    </Button>
                    <Button variant="default" asChild>
                        <a href="https://dashboard.buildwithfern.com/sign-up?redirect_on_login=/get-started">
                            Create a Fern Docs site
                        </a>
                    </Button>
                </div>
                <p className="text-(color:--grayscale-a11) text-[0.8125rem]">
                    Still need help? Contact{" "}
                    <a href="mailto:support@buildwithfern.com" className="text-(color:--grayscale-a11) underline">
                        support@buildwithfern.com
                    </a>
                    .
                </p>
            </div>
        </div>
    );
}
