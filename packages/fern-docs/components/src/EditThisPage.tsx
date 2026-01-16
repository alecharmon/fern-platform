import { t } from "@fern-docs/i18n";
import { Edit } from "lucide-react";
import type { ReactElement } from "react";
import { ButtonLink } from "./FernLinkButton";

interface EditThisPageButtonProps {
    editThisPageUrl: string | undefined;
    lang: string;
}

export function EditThisPageButton({ editThisPageUrl, lang }: EditThisPageButtonProps): ReactElement<any> | null {
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

interface EditInDashboardButtonProps {
    docsUrl: string;
    slug: string;
    lang: string;
    dashboardHost?: string;
    fallbackUrl?: string;
}

export function EditInDashboardButton({
    docsUrl,
    slug,
    lang,
    dashboardHost = "dashboard.buildwithfern.com",
    fallbackUrl
}: EditInDashboardButtonProps): ReactElement<any> {
    let editUrl = `https://${dashboardHost}/edit-page?docsUrl=${encodeURIComponent(docsUrl)}&slug=${encodeURIComponent(slug)}`;
    if (fallbackUrl) {
        editUrl += `&fallbackUrl=${encodeURIComponent(fallbackUrl)}`;
    }

    return (
        <ButtonLink href={editUrl} variant="outline" size="sm" target="_blank">
            <Edit />
            {t(lang).buttons.editInDashboard}
        </ButtonLink>
    );
}
