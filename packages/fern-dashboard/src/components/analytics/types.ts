import type { FernAI } from "@fern-api/fai-sdk";

export interface ConversationRow {
    conversation_id: string;
    first_query: string;
    source: string;
    message_count: number;
    created_at: string;
}

export function groupQueriesByConversation(queries: FernAI.Query[]): ConversationRow[] {
    const conversationMap = new Map<string, ConversationRow>();

    for (const query of queries) {
        const existing = conversationMap.get(query.conversation_id);

        if (!existing) {
            conversationMap.set(query.conversation_id, {
                conversation_id: query.conversation_id,
                first_query: query.text,
                source: query.source,
                message_count: 1,
                created_at: query.created_at
            });
        } else {
            existing.message_count += 1;
            if (new Date(query.created_at) < new Date(existing.created_at)) {
                existing.created_at = query.created_at;
                existing.first_query = query.text;
                existing.source = query.source;
            }
        }
    }

    return Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}
