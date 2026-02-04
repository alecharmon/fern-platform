import { Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";

/**
 * Extension that closes the history group when Enter is pressed.
 * This ensures that each line becomes its own undo group, making undo behavior
 * more predictable - pressing Ctrl+Z will undo back to the previous line
 * rather than undoing large chunks of text at once.
 */
export const EnterHistoryGroupExtension = Extension.create({
    name: "enterHistoryGroup",

    addKeyboardShortcuts() {
        return {
            Enter: ({ editor }) => {
                // Close the current history group before the newline is inserted.
                // This ensures that the newline and subsequent text will be in a new undo group.
                const { tr } = editor.state;
                closeHistory(tr);
                editor.view.dispatch(tr);

                // Return false to let the default Enter behavior happen
                // (which will now be in a new history group)
                return false;
            }
        };
    }
});
