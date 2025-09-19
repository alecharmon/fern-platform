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
  children,
}) => {
  const value: EditorComponentContextValue = {
    keyedAttributes,
    updateKeyedAttributes,
    appendChildrenMdx,
    deleteSelf,
    isWithinEditor,
    providedChildren,
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
