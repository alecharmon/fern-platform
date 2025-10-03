import {
    Bold,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Image,
    Italic,
    Link,
    List,
    ListOrdered,
    LucideProps,
    MessageSquareQuote,
    Plus,
    Strikethrough,
    Type,
    Underline
} from "lucide-react";

import { HeadingDropdown } from "./custom/HeadingDropdown";
import { CustomIconProps } from "./custom/types";

// Map icon names to their corresponding components
const ICONS = {
    Bold,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Image,
    Italic,
    Link,
    List,
    ListOrdered,
    MessageSquareQuote,
    Plus,
    Strikethrough,
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
    const { size = 24, color = "currentColor" } = props;
    return { size, color };
}
