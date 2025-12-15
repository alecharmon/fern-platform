import { ChevronDown } from "lucide-react";
import { FernButton } from "../../FernButton";
import { FernDropdown } from "../../FernDropdown";
import { FaIcon } from "../../fa-icon";

import { getIconForClient, getLanguageDisplayName } from "../examples/code-example";

export declare namespace CodeExampleClientDropdown {
    export interface Props {
        languages: string[];
        value: string;
        onValueChange: (language: string) => void;
        lang: string;
    }
}

export const CodeExampleClientDropdown: React.FC<CodeExampleClientDropdown.Props> = ({
    languages,
    value,
    onValueChange,
    lang
}) => {
    const options = languages.map((language) => ({
        type: "value" as const,
        label: getLanguageDisplayName(language),
        value: language,
        className: "group/option",
        icon: (
            <FaIcon
                className="size-icon-sm text-body group-data-[highlighted]/option:text-(color:--accent-contrast)"
                icon={getIconForClient(language)}
            />
        )
    }));

    const selectedOption = options.find((option) => option.value === value);
    return (
        <div className="flex justify-end">
            <FernDropdown value={value} options={options} onValueChange={onValueChange} lang={lang}>
                <FernButton
                    icon={<FaIcon className="text-(color:--accent-a11) size-4" icon={getIconForClient(value)} />}
                    rightIcon={<ChevronDown className="!size-icon" />}
                    text={selectedOption?.label ?? getLanguageDisplayName(value)}
                    size="small"
                    variant="outlined"
                    mono={true}
                />
            </FernDropdown>
        </div>
    );
};
