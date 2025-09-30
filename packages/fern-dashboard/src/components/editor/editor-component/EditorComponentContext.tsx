"use client";

import React, { ReactNode, createContext, useContext } from "react";

import { KeyedAttributes } from "../editor-mdx-renderer/types";

interface EditorComponentContextValue {
  keyedAttributes: KeyedAttributes;
  updateKeyedAttributes: (
    callback: (current: KeyedAttributes) => KeyedAttributes
  ) => unknown;
  appendChildrenMdx: (newChild: string) => unknown;
  deleteSelf: () => unknown;
  providedChildren: React.ReactElement;
  isWithinEditor: boolean;
  index: number;
  newlyCreated?: boolean;
}

const EditorComponentContext = createContext<EditorComponentContextValue>({
  keyedAttributes: {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  updateKeyedAttributes: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  appendChildrenMdx: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  deleteSelf: () => {},
  providedChildren: <></>,
  isWithinEditor: false,
  index: 0,
  newlyCreated: false,
});
export const EditorComponentProvider: React.FC<
  EditorComponentContextValue & {
    children: ReactNode;
  }
> = ({
  providedChildren,
  keyedAttributes,
  updateKeyedAttributes,
  appendChildrenMdx,
  deleteSelf,
  isWithinEditor,
  index,
  newlyCreated,
  children,
}) => {
  const value: EditorComponentContextValue = {
    keyedAttributes,
    updateKeyedAttributes,
    appendChildrenMdx,
    deleteSelf,
    isWithinEditor,
    providedChildren,
    index,
    newlyCreated,
  };

  return (
    <EditorComponentContext.Provider value={value}>
      {children}
    </EditorComponentContext.Provider>
  );
};

export const useEditorComponent = (): EditorComponentContextValue => {
  return useContext(EditorComponentContext);
};

export const InterceptedChildren = () => {
  const { providedChildren } = useContext(EditorComponentContext);
  return providedChildren;
};
