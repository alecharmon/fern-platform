import React, { useRef } from "react";

import { CirclePlusIcon } from "lucide-react";

import { Button, cn } from "@fern-docs/components";

import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
  EditorComponentPopoverButton,
  EditorComponentPopoverProvider,
} from "@/components/editor/editor-component/EditorComponentPopover";
import { IntegerInputControl } from "@/components/editor/editor-component/controls";

import { CardGroupProvider, useCardGroup } from "./CardGroupContext";

export const EMPTY_CARD_CONTENT = `
<Card title="Untitled" icon="leaf">

</Card>
`;

export const EMPTY_CARD_GROUP_CONTENT = `
<CardGroup>
  ${EMPTY_CARD_CONTENT}
</CardGroup>
`;

function CardGroupContent({
  children,
  cols: explicitCols,
}: React.PropsWithChildren<{
  cols?: number;
}>) {
  const { isWithinEditor, appendChildrenMdx } = useEditorComponent();
  const cardGroupRef = useRef<HTMLDivElement>(null);
  const cardGroup = useCardGroup();

  // Use explicit cols if provided, otherwise default based on registered card count
  const cols =
    explicitCols ?? Math.min(Math.max(cardGroup?.cardCount ?? 1, 1), 2);

  const content = (
    <div
      ref={cardGroupRef}
      className={cn("relative my-6 grid gap-4 first:mt-0 sm:gap-6", {
        "grid-cols-1": cols <= 1,
        "grid-cols-1 sm:grid-cols-2": cols === 2,
        "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3": cols === 3,
        "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4": cols === 4,
        "grid-cols-1 sm:grid-cols-2 xl:grid-cols-5": cols === 5,
        "grid-cols-1 sm:grid-cols-2 xl:grid-cols-6": cols >= 6,
      })}
    >
      {isWithinEditor && (
        <EditorComponentPopoverButton className="absolute -right-10 top-0" />
      )}
      {children}
    </div>
  );

  if (!isWithinEditor) {
    return content;
  }

  return (
    <>
      <EditorComponentPopoverProvider
        attributes={{
          cols: new IntegerInputControl({
            defaultValue: explicitCols,
            min: 1,
            max: 6,
          }),
        }}
        targetRef={cardGroupRef}
        hoverSlopThreshold={50}
        openPopoverIfNewlyCreated={false}
      >
        {content}
      </EditorComponentPopoverProvider>
      <div className="-mt-6 mb-1 flex justify-center p-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            appendChildrenMdx(EMPTY_CARD_CONTENT);
          }}
        >
          <CirclePlusIcon />
          Add card
        </Button>
      </div>
    </>
  );
}

export function CardGroup(props: React.PropsWithChildren<{ cols?: number }>) {
  return (
    <CardGroupProvider>
      <CardGroupContent {...props} />
    </CardGroupProvider>
  );
}
