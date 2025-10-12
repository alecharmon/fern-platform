import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernLink } from "@fern-docs/components/FernLink";
import type { PropsWithChildren, ReactElement } from "react";

export function FernLinkDropdown(props: PropsWithChildren<FernDropdown.Props>): ReactElement<any> {
    // dropdownMenuElement is cloned in FernDropdown and href is passed to the cloned element
    // TODO: make this more composeable
    return <FernDropdown {...props} dropdownMenuElement={<FernLink href={""} scroll={true} />} />;
}
