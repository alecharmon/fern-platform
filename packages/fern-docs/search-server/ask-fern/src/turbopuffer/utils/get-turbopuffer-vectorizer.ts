import { type Embedding, type EmbeddingModel, embedMany } from "ai";
import { encode } from "gpt-tokenizer";

interface EmbedManyWithRetryOptions {
    model: EmbeddingModel<string>;
    values: string[];
    maxRetries: number;
    retryBaseMs: number;
}

async function embedManyWithRetry({
    model,
    values,
    maxRetries,
    retryBaseMs
}: EmbedManyWithRetryOptions): Promise<{ embeddings: Embedding[]; tokenCount: number }> {
    let lastError: Error | undefined;
    let tokenCount = 0;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const embeddingOutput = await embedMany({
                model,
                values
            });
            tokenCount = embeddingOutput.usage?.tokens ?? 0;
            return { embeddings: embeddingOutput.embeddings, tokenCount };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const errorMessage = lastError.message;

            let waitMs = retryBaseMs * Math.pow(2, attempt);
            const jitter = Math.random() * 0.3 * waitMs;
            waitMs = waitMs + jitter;

            const retryAfterMatch = errorMessage.match(/try again in (\d+)ms/i);
            const ms = parseInt(retryAfterMatch?.[1] ?? "0", 10);
            waitMs = Math.max(waitMs, ms);

            if (attempt < maxRetries - 1) {
                console.log(
                    `[embedMany] Attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}. Retrying in ${Math.round(waitMs)}ms...`
                );
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }
    }

    throw new Error(`Failed to embed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

export function getTurbopufferVectorizer(
    embeddingModel: EmbeddingModel<string>
): (chunks: string[]) => Promise<Embedding[]> {
    return async (chunks: string[]) => {
        const maxTokensPerRequest = 15000;
        const maxRetries = 5;
        const retryBaseMs = 1000;
        const interBatchDelayMs = 500;

        let payload: string[] = [];
        let payloadTokenCount = 0;
        let embeddings: Embedding[] = [];
        let totalBatches = 0;
        let totalRetries = 0;
        let hadRateLimit = false;

        async function sendBatch(isFinal = false): Promise<void> {
            totalBatches++;
            const batchTokens = payloadTokenCount;
            const batchStartTime = Date.now();

            try {
                const { embeddings: batchEmbeddings } = await embedManyWithRetry({
                    model: embeddingModel,
                    values: payload,
                    maxRetries,
                    retryBaseMs
                });
                embeddings = embeddings.concat(batchEmbeddings);

                const batchDuration = Date.now() - batchStartTime;
                console.log(
                    `[vectorizer] Batch ${totalBatches}${isFinal ? " (final)" : ""}: ${payload.length} chunks, ${batchTokens} tokens, ${batchDuration}ms`
                );

                if (!isFinal && (hadRateLimit || batchTokens > maxTokensPerRequest * 0.8)) {
                    const delayWithJitter = interBatchDelayMs + Math.random() * 0.3 * interBatchDelayMs;
                    await new Promise((resolve) => setTimeout(resolve, delayWithJitter));
                }
            } catch (error) {
                if (error instanceof Error && error.message.includes("rate limit")) {
                    hadRateLimit = true;
                    totalRetries++;
                }
                throw error;
            } finally {
                payload = [];
                payloadTokenCount = 0;
            }
        }

        for (const chunk of chunks) {
            const chunkTokens = encode(chunk).length;

            if (payload.length > 0 && payloadTokenCount + chunkTokens > maxTokensPerRequest) {
                await sendBatch(false);
            }

            payload.push(chunk);
            payloadTokenCount += chunkTokens;
        }

        if (payload.length > 0) {
            await sendBatch(true);
        }

        console.log(
            `[vectorizer] Completed: ${totalBatches} batches, ${embeddings.length} embeddings, ${totalRetries} rate limit retries`
        );

        return embeddings;
    };
}
