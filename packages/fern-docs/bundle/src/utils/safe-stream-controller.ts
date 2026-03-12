import { logger } from "@fern-api/ui-core-utils/logger";

export type SafeStreamController<T> = {
    enqueue: (chunk: T) => void;
    close: () => void;
};

export function createSafeStreamController<T>(
    controller: ReadableStreamDefaultController<T>,
    warnPrefix = "[stream]"
): SafeStreamController<T> {
    let closed = false;

    return {
        enqueue(chunk: T): void {
            if (closed) {
                return;
            }
            try {
                controller.enqueue(chunk);
            } catch (e) {
                closed = true;
                logger.warn(
                    `${warnPrefix} enqueue failed (controller closed?). Proceeding without streaming updates.`,
                    e
                );
            }
        },
        close(): void {
            if (closed) {
                return;
            }
            try {
                controller.close();
            } catch (e) {
                logger.warn(`${warnPrefix} close failed (already closed?).`, e);
            } finally {
                closed = true;
            }
        }
    };
}
