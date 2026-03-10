"use client";

import { useQuery } from "@tanstack/react-query";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { PostmanLogo } from "../auth/PostmanLogo";

export declare namespace PostmanConnection {
    export interface Props {
        orgName: Auth0OrgName;
    }
}

interface PostmanConnectionInfo {
    teamId: string;
    teamName: string | null;
}

function usePostmanConnection(orgName: Auth0OrgName) {
    return useQuery<PostmanConnectionInfo | null>({
        queryKey: ["postman-connection", orgName],
        queryFn: async () => {
            const response = await fetch("/api/get-postman-connection", {
                method: "POST",
                body: JSON.stringify({ orgName })
            });
            if (!response.ok) {
                throw new Error("Failed to fetch Postman connection");
            }
            return response.json();
        }
    });
}

export function PostmanConnection({ orgName }: PostmanConnection.Props) {
    const { data: connection, isLoading } = usePostmanConnection(orgName);

    if (isLoading || !connection) {
        return null;
    }

    const displayName = connection.teamName ?? connection.teamId;

    return (
        <div className="border-border mx-auto flex w-full max-w-[750px] flex-col rounded-xl border bg-gray-100 p-4">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-bold">
                    <PostmanLogo />
                    Postman connection
                </div>
                <div className="text-gray-900">
                    This Fern org is connected to the{" "}
                    <span
                        className="rounded-md bg-gray-300 px-1.5 py-0.5 text-gray-1100"
                        style={{ fontFamily: "Berkeley Mono, monospace" }}
                    >
                        {displayName}
                    </span>{" "}
                    team.
                </div>
            </div>
        </div>
    );
}
