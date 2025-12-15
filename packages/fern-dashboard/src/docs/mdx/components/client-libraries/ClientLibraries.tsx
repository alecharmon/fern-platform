import { FernSdk } from "@fern-docs/components/FernSdk";
import { useProgrammingLanguage } from "@fern-docs/components/state/language";
import type { ComponentProps, FC } from "react";

export const ClientLibraries: FC<Pick<ComponentProps<typeof FernSdk>, "sdks">> = ({ sdks }) => {
    const [language, setLanguage] = useProgrammingLanguage();
    return <FernSdk sdks={sdks} language={language} onChange={setLanguage} />;
};
