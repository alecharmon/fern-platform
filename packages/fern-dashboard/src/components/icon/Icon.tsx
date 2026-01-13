import {
    Bold,
    ChevronDown,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Image,
    Italic,
    Link,
    List,
    ListCheck,
    ListOrdered,
    type LucideProps,
    MessageSquareQuote,
    Plus,
    Strikethrough,
    Trash2,
    Type,
    Underline
} from "lucide-react";

import { HeadingDropdown } from "./custom/HeadingDropdown";
import type { CustomIconProps } from "./custom/types";

// Map icon names to their corresponding components
const ICONS = {
    Bold,
    ChevronDown,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Image,
    Italic,
    Link,
    List,
    ListCheck,
    ListOrdered,
    MessageSquareQuote,
    Plus,
    Strikethrough,
    Trash2,
    Type,
    Underline,
    HeadingDropdown
};

// Infer icon names type
export type IconName = keyof typeof ICONS;

// Maintain compatibility between Lucide React props and custom icon props
type CommonIconProps = LucideProps & CustomIconProps;

export declare namespace Icon {
    export interface Props extends CommonIconProps {
        variant: IconName;
    }
}

export function Icon({ variant, ...props }: Icon.Props) {
    const Component = ICONS[variant];
    const propsWithDefaults = defaultIconProps(props);
    return <Component {...propsWithDefaults} />;
}

function defaultIconProps(props: CommonIconProps) {
    const { size = 24, color = "currentColor", ...rest } = props;
    return { size, color, ...rest };
}
