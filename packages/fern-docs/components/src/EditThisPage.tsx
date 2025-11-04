import { t } from "@fern-docs/i18n";
import { Edit } from "lucide-react";
import type { ReactElement } from "react";
import { ButtonLink } from "./FernLinkButton";

interface EditThisPageButton {
    editThisPageUrl: string | undefined;
    lang: string;
}
export function EditThisPageButton({ editThisPageUrl, lang }: EditThisPageButton): ReactElement<any> | null {
    if (typeof editThisPageUrl !== "string") {
        return null;
    }
    return (
        <ButtonLink href={editThisPageUrl} variant="outline" size="sm">
            <Edit />
            {t(lang).buttons.editThisPage}
        </ButtonLink>
    );
}
