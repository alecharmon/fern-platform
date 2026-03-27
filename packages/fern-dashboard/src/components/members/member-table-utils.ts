import type { Roles } from "@fern-api/user-permissions";
import type { GetMembers200ResponseOneOfInner } from "auth0";
import type { OrgInvitation } from "@/state/types";

export type LoginType = "Google" | "GitHub" | "Postman" | "SSO" | "Pending";

export interface MemberTableRow {
    id: string;
    name: string;
    email: string;
    pictureUrl?: string;
    roles: Roles[];
    lastLogin?: string;
    loginType: LoginType;
    kind: "member" | "invitee";
    raw: GetMembers200ResponseOneOfInner | OrgInvitation;
}

export function getLoginType(userId: string): Exclude<LoginType, "Pending"> {
    if (userId.startsWith("google-oauth2|")) {
        return "Google";
    }
    if (userId.startsWith("github|")) {
        return "GitHub";
    }
    if (userId.startsWith("oauth2|postman|")) {
        return "Postman";
    }
    return "SSO";
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function getRelativeTimeString(isoDate: string | undefined): string {
    if (!isoDate) {
        return "Not logged in";
    }

    const diff = Date.now() - new Date(isoDate).getTime();
    if (diff < MINUTE) {
        return "Just now";
    }
    if (diff < HOUR) {
        const mins = Math.floor(diff / MINUTE);
        return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
    }
    if (diff < DAY) {
        const hours = Math.floor(diff / HOUR);
        return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    }
    const days = Math.floor(diff / DAY);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
}
