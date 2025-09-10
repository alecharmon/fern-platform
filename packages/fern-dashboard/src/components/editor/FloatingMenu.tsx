import { MouseEventHandler } from "react";

import { useCurrentEditor } from "@tiptap/react";
import { FloatingMenu as EditorFloatingMenu } from "@tiptap/react/menus";

import { Icon } from "@/components/icon/Icon";

import { FloatingMenuAction, menuItems } from "./floating-menu-options";

export default function FloatingMenu() {
  const { editor } = useCurrentEditor();

  function menuItemClickHandler(action: FloatingMenuAction) {
    return () => {
      if (!editor) return;

      // Remove the entire search text (including "/" and any typed text)
      const { selection } = editor.state;
      const { $from } = selection;

      if ($from.parent.textContent.startsWith("/")) {
        // Delete the entire search text from start of paragraph
        const searchTextLength = $from.parent.textContent.length;
        editor
          .chain()
          .focus()
          .deleteRange({
            from: $from.start(),
            to: $from.start() + searchTextLength,
          })
          .run();
      }

      switch (action) {
        case "plainText":
          // Just remove the "/" and stay in text mode
          break;
        case "toggleHeading1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "toggleHeading2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "toggleHeading3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case "toggleBulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "toggleOrderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "toggleQuote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "toggleMedia":
          editor.chain().focus().setMediaUploadNode().run();
          break;
        // TODO: Add link
        // case "setLink":
        //   // TODO: This should open an additional popover to edit the link
        //   editor
        //     .chain()
        //     .focus()
        //     .setLink({ href: "https://www.google.com" })
        //     .run();
        //   break;
        default:
          break;
      }
    };
  }

  return (
    <EditorFloatingMenu
      editor={null}
      options={{ placement: "bottom-start" }}
      shouldShow={({ editor, state }) => {
        const { selection } = state;
        const { $from } = selection;

        // Check if we're at the start of a paragraph that begins with "/"
        return (
          editor.isFocused &&
          selection.empty &&
          $from.parent.type.name === "paragraph" &&
          $from.parent.textContent.startsWith("/") &&
          $from.parentOffset === $from.parent.textContent.length
        );
      }}
    >
      <div className="border-1 text-gray-1100 rounded-2 flex min-w-60 flex-col border-gray-500 bg-white p-1 pt-2 shadow-sm">
        <FloatingMenuHeading title="Basics" />
        {menuItems.map((item) => (
          <FloatingMenuItem
            key={item.action}
            title={item.title}
            iconProps={item.iconProps}
            onClick={menuItemClickHandler(item.action)}
          />
        ))}
        {/* 
        TODO: Add link
        <FloatingMenuItem
          title="Link"
          iconProps={{ variant: "Link" }}
          onClick={menuItemClickHandler("setLink")}
        /> */}
      </div>
    </EditorFloatingMenu>
  );
}

declare namespace FloatingMenuHeading {
  export interface Props {
    title: string;
  }
}

function FloatingMenuHeading({ title }: FloatingMenuHeading.Props) {
  return (
    <div className="px-3 py-1 text-sm font-bold uppercase text-gray-800">
      {title}
    </div>
  );
}

declare namespace FloatingMenuItem {
  export interface Props {
    title: string;
    iconProps: Icon.Props;
    onClick?: MouseEventHandler<HTMLButtonElement>;
  }
}

function FloatingMenuItem({
  title,
  iconProps,
  onClick,
}: FloatingMenuItem.Props) {
  const { size = 20, ...restIconProps } = iconProps;

  return (
    <button
      className="rounded-1 flex h-8 cursor-pointer items-center gap-2 px-3 transition-colors hover:bg-gray-300 hover:transition-none"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex size-4 items-center justify-center">
        <Icon size={size} {...restIconProps} />
      </div>
      <div className="text-md font-medium">{title}</div>
    </button>
  );
}
