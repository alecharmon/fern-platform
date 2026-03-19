import { DomainNotFoundContent } from "@fern-docs/components/not-found/DomainNotFoundContent";
import { FernThemedPage } from "@fern-docs/components/not-found/FernThemedPage";
import { NotFoundTracker } from "@fern-docs/components/not-found/NotFoundTracker";

export default async function RootNotFound() {
    return (
        <FernThemedPage>
            <NotFoundTracker />
            <DomainNotFoundContent />
        </FernThemedPage>
    );
}
