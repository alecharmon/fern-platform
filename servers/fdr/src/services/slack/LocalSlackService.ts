import type {
    FailedToDeleteIndexSegment,
    FailedToRegisterDocsNotification,
    FailedToRevalidatePathsNotification,
    GeneratingDocsNotification,
    SlackService
} from "./SlackService";

export class LocalSlackServiceImpl implements SlackService {
    async notify(_message: string, _err: unknown): Promise<void> {
        return;
    }
    async notifyFailedToRegisterDocs(_request: FailedToRegisterDocsNotification): Promise<void> {
        return;
    }
    async notifyFailedToRevalidatePaths(_request: FailedToRevalidatePathsNotification): Promise<void> {
        return;
    }
    async notifyFailedToDeleteIndexSegment(_request: FailedToDeleteIndexSegment): Promise<void> {
        return;
    }
    async notifyGeneratedDocs(_request: GeneratingDocsNotification): Promise<void> {
        return;
    }
}
