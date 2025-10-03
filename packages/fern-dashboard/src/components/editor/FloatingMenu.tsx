import { SlashDropdownMenu } from "../tiptap-ui/slash-dropdown-menu";
import { slashMenuItems } from "./floating-menu-options";

export default function FloatingMenu() {
    return (
        <SlashDropdownMenu
            config={{
                enabledItems: ["text", "heading_1", "heading_2", "heading_3", "bullet_list", "ordered_list", "quote"],
                customItems: slashMenuItems
            }}
        />
    );
}
