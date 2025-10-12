import { FernSdk } from "@fern-docs/components/FernSdk";
import type { ComponentProps, FC } from "react";

import { useProgrammingLanguage } from "@/state/language";

export const ClientLibraries: FC<Pick<ComponentProps<typeof FernSdk>, "sdks">> = ({ sdks }) => {
    const [language, setLanguage] = useProgrammingLanguage();
    return <FernSdk sdks={sdks} language={language} onChange={setLanguage} />;
};
