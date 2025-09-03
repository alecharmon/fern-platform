"use server";

import { FernAI } from "@fern-api/fai-sdk";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getFaiClient } from "../services/fai/getFaiClient";

export async function getConversation({
  domain,
  conversationId,
}: {
  domain: string;
  conversationId: string;
}): Promise<FernAI.Conversation> {
  const session = await getCurrentSessionOrThrow();
  const faiClient = getFaiClient({ token: session.accessToken });
  const response = await faiClient.conversation.getConversationById(
    domain,
    conversationId
  );
  return response.conversation;
}
