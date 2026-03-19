import { DomainNotFoundContent } from "@fern-docs/components/not-found/DomainNotFoundContent";
import { FernThemedPage } from "@fern-docs/components/not-found/FernThemedPage";

export default async function RootPage() {
    return (
        <FernThemedPage>
            <DomainNotFoundContent />
        </FernThemedPage>
    );
}
