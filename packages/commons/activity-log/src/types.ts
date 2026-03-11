export interface AskFernEvent {
    type: "ask_fern";
    metadata: {
        user_id?: string;
        question: string;
        response_tokens: number;
    };
}

export interface FernWriterEvent {
    type: "fern_writer";
    metadata: {
        user_id?: string;
        github_repo: string;
        channel?: string;
        message_text?: string;
        response_tokens: number;
    };
}

export type ActivityLogEntry = AskFernEvent | FernWriterEvent;
export type ActivityLogType = ActivityLogEntry["type"];

export interface ActivityLog {
    id: string;
    org_id: string;
    site: string;
    type: ActivityLogType;
    metadata: Record<string, unknown>;
    expires_at: string | null;
    created_at: string;
}

export interface OrgFernCreditUsage {
    id: string;
    org_id: string;
    site: string;
    type: ActivityLogType;
    credits_used: number;
    event_id: string | null;
    created_at: string;
}

export interface Duration {
    days?: number;
    hours?: number;
}
