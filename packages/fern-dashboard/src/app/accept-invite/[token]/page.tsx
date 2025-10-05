import "server-only";

import Link from "next/link";
import { Suspense } from "react";

import { Loader2 } from "lucide-react";

import { type RedeemInviteTokenErrors, redeemInviteToken } from "@/app/actions/redeemInviteToken";
import { GithubLoginButton, GoogleLoginButton } from "@/components/auth/LoginButton";
import { LoginImage } from "@/components/login-page/LoginImage";
import { Button } from "@/components/ui/button";

import AcceptInviteSuccess from "./AcceptInviteSuccess";
import "./invite-page.scss";

export const revalidate = 0;

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return (
        <div className="relative flex h-[100dvh] w-screen items-center justify-center overflow-hidden">
            <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-60">
                <LoginImage />
            </div>
            <div className="relative z-50 flex w-[500px] flex-col justify-center gap-4 rounded-lg bg-gray-50 p-6 py-10 text-center shadow-lg">
                <h2 className="text-center text-3xl font-extrabold text-gray-900">Accept Invitation</h2>
                <Suspense fallback={<Loader text="Accepting invitation..." />}>
                    <AcceptInviteHandler token={token} />
                </Suspense>
            </div>
        </div>
    );
}

async function AcceptInviteHandler({ token }: { token: string }) {
    try {
        const result = await redeemInviteToken({ token });
        if (result.success) {
            return <AcceptInviteSuccess orgName={result.orgName} userId={result.userId} />;
        } else {
            if (result.error.type === "NOT_LOGGED_IN") {
                return (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
                        <div className="text-muted-foreground mb-4 text-sm">
                            Please sign in to accept the invitation.
                        </div>
                        <GithubLoginButton returnTo={`/accept-invite/${token}`} />
                        <GoogleLoginButton returnTo={`/accept-invite/${token}`} />
                    </div>
                );
            }

            return (
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="text-muted-foreground text-sm">{DisplayTokenError(result.error)}</div>
                    <Button asChild>
                        <Link href="/">Return to homepage</Link>
                    </Button>
                </div>
            );
        }
    } catch (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-muted-foreground text-sm">
                    {error instanceof Error ? error.message : "Failed to accept invitation."}
                </div>
                <Button asChild>
                    <Link href="/">Return to homepage</Link>
                </Button>
            </div>
        );
    }
}

const DisplayTokenError = ({ type }: RedeemInviteTokenErrors) => {
    switch (type) {
        case "NOT_LOGGED_IN":
            return "Please sign in to accept the invitation.";
        case "INVITE_TOKEN_NOT_FOUND":
            return "This invite link was not found or has already been used. Please contact the sender for a new link.";
        case "EXPIRED_INVITE_TOKEN":
            return "This invite link has expired. Please contact the sender for a new link.";
        default:
            return "Failed to accept invitation.";
    }
};

const Loader = ({ text }: { text: string }) => {
    return (
        <div className="text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {text}
        </div>
    );
};
