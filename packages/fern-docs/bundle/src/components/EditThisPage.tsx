import { ButtonLink } from "@fern-docs/components/FernLinkButton";

import { Edit } from "lucide-react";
import type { ReactElement } from "react";

import { i18n } from "@/constants";

interface EditThisPageButton {
    editThisPageUrl: string | undefined;
}
export function EditThisPageButton(props: EditThisPageButton): ReactElement<any> | null {
    if (typeof props.editThisPageUrl !== "string") {
        return null;
    }
    return (
        <ButtonLink href={props.editThisPageUrl} variant="outline" size="sm">
            <Edit />
            {i18n.buttons.editThisPage}
        </ButtonLink>
    );
}
