import type { Element as HastElement } from "hast";

type PropsWithElement<T> = T & { node: HastElement };

export function HideHeadersInUserMessage() {
  return {
    h1: ({ children }: PropsWithElement<React.ComponentProps<"h1">>) =>
      children,
    h2: ({ children }: PropsWithElement<React.ComponentProps<"h2">>) =>
      children,
    h3: ({ children }: PropsWithElement<React.ComponentProps<"h3">>) =>
      children,
    h4: ({ children }: PropsWithElement<React.ComponentProps<"h4">>) =>
      children,
    h5: ({ children }: PropsWithElement<React.ComponentProps<"h5">>) =>
      children,
    h6: ({ children }: PropsWithElement<React.ComponentProps<"h6">>) =>
      children,
  };
}
