import { Embedding, EmbeddingModel, embedMany } from "ai";

export function getTurbopufferVectorizer(
    embeddingModel: EmbeddingModel<string>
): (chunks: string[]) => Promise<Embedding[]> {
    return async (chunks: string[]) => {
        let payload = [];
        let payloadLength = 0;
        let embeddings: Embedding[] = [];

        for (const chunk of chunks) {
            payloadLength += chunk.length;
            payload.push(chunk);
            if (payloadLength >= 100_000) {
                const embeddingOutput = await embedMany({
                    model: embeddingModel,
                    values: payload
                });
                embeddings = embeddings.concat(embeddingOutput.embeddings);
                payload = [];
                payloadLength = 0;
            }
        }
        if (payload.length > 0) {
            const embeddingOutput = await embedMany({
                model: embeddingModel,
                values: payload
            });
            embeddings = embeddings.concat(embeddingOutput.embeddings);
        }
        return embeddings;
    };
}
