"use client";

import NotFoundContentComponent from "@fern-docs/components/not-found/NotFoundContent";
import ReturnHomeButton from "@fern-docs/components/ReturnHomeButton";
import { NotFound404Tracker } from "../analytics/NotFound404Tracker";

export default function NotFoundContent({ lang }: { lang: string }) {
    return (
        <NotFoundContentComponent
            lang={lang}
            tracker={<NotFound404Tracker />}
            actionButton={<ReturnHomeButton lang={lang} />}
        />
    );
}
