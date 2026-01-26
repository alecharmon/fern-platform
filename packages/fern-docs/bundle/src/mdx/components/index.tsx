"use client";

import type { MDXComponents } from "@fern-docs/mdx";
import dynamic from "next/dynamic";
import type { ComponentProps, ReactElement } from "react";

import { ErrorBoundary, ErrorBoundaryFallback } from "@/components/error-boundary";
import { SearchV2Trigger } from "@/state/search";

import { Accordion, AccordionGroup } from "./accordion";
import { Anchor } from "./anchor";
import { Availability } from "./availability";
import { Badge } from "./badge";
import { Bleed } from "./bleed";
import { Button, ButtonGroup } from "./button";
import { CallToAction } from "./call-to-action";
import {
    Callout,
    CheckCallout,
    ErrorCallout,
    InfoCallout,
    LaunchCallout,
    NoteCallout,
    SuccessCallout,
    TipCallout,
    WarningCallout
} from "./callout";
import { Card, CardGroup } from "./card";
import { ClientLibraries } from "./client-libraries";
import { Template } from "./code/Template";
import { Column, ColumnGroup } from "./columns";
import { Copy } from "./copy";
import { Download } from "./download";
import { Feature } from "./feature";
import { File, Files, Folder, Indent } from "./files";
import { Frame } from "./frame";
import { A, HeadingRenderer, Image, Li, Ol, P, Strong, Ul } from "./html";
import { Table } from "./html-table";
import { Icon } from "./icon/Icon";
import { If } from "./if";
import { IFrame } from "./iframe/IFrame";
import { Json } from "./json";
import { ParamField } from "./parameters/ParamField";
import {
    EndpointRequestSnippet,
    EndpointResponseSnippet,
    MergeAccessedThirdPartyEndpointsWidget,
    MergeSupportedFieldsByIntegrationWidget,
    Schema,
    SchemaSnippet,
    WebhookPayloadSnippet
} from "./snippets";
import { EndpointSchemaSnippet } from "./snippets/EndpointSchemaSnippet";
import { Step, StepGroup } from "./steps";
import { Tab, TabGroup } from "./tabs";
import { Tooltip } from "./tooltip";
import { Version, Versions } from "./versions";

// Loading fallback for code blocks - preserves layout during loading
const CodeBlockFallback = () => (
    <div className="fern-code fern-code-block bg-card-background border-card-border rounded-3 shadow-card-grayscale relative mb-6 mt-4 flex w-full min-w-0 max-w-full flex-col border first:mt-0 min-h-[100px] animate-pulse" />
);

// Loading fallback for Mermaid diagrams
const MermaidFallback = () => (
    <div className="mermaid-container min-h-[200px] animate-pulse bg-card-background rounded-3" />
);

// Dynamic imports for heavy components to reduce initial bundle size

// CodeBlock uses Shiki for syntax highlighting - heavy dependency (~500KB)
const CodeBlock = dynamic(() => import("./code/CodeBlock").then((mod) => mod.CodeBlock), {
    loading: CodeBlockFallback
});

// CodeBlocks wraps multiple CodeBlock components
const CodeBlocks = dynamic(() => import("./code/CodeBlocks").then((mod) => mod.CodeBlocks), {
    loading: CodeBlockFallback
});

// CodeGroup uses Shiki and adds tab functionality
const CodeGroup = dynamic(() => import("./code/CodeGroup").then((mod) => mod.CodeGroup), {
    loading: CodeBlockFallback
});

// Mermaid uses mermaid.js for diagrams (~1MB)
const Mermaid = dynamic(() => import("./mermaid").then((mod) => mod.Mermaid), {
    ssr: false,
    loading: MermaidFallback
});

// TwoSlash renders dynamic code blocks with type information
const TwoSlash = dynamic(() => import("./twoslash/TwoSlash").then((mod) => mod.TwoSlash), {
    loading: CodeBlockFallback
});

// RunnableEndpoint is a complex interactive playground component
const RunnableEndpoint = dynamic(() => import("./runnable-endpoint").then((mod) => mod.RunnableEndpoint), {
    loading: () => (
        <div className="fern-runnable-endpoint my-6 min-h-[200px] animate-pulse bg-card-background rounded-3" />
    )
});

const ElevenLabsWaveform = dynamic(
    () => import("./waveform/WaveformComplex").then((mod) => mod.default),
    { ssr: false, loading: () => <div className="h-[400px]" /> } // prevent layout shift
);

const FERN_COMPONENTS = {
    Accordion,
    AccordionGroup,
    Anchor,
    Availability,
    Badge,
    Bleed,
    Button,
    ButtonGroup,
    Callout,
    CallToAction,
    Card,
    CardGroup,
    ClientLibraries,
    CodeBlock,
    CodeGroup,
    Column,
    ColumnGroup,
    Copy,
    Download,
    EndpointRequestSnippet,
    EndpointResponseSnippet,
    EndpointSchemaSnippet,
    Feature,
    File,
    Files,
    Folder,
    Frame,
    Indent,
    Icon,
    If,
    Json,
    MergeAccessedThirdPartyEndpointsWidget,
    MergeSupportedFieldsByIntegrationWidget,
    Mermaid,
    ParamField,
    RunnableEndpoint,
    Schema,
    SchemaSnippet,
    SearchBar: SearchV2Trigger,
    WebhookPayloadSnippet,
    Step,
    StepGroup,
    Tab,
    TabGroup,
    Template,
    Tooltip,
    TwoSlash,
    Version,
    Versions,
    // callout aliases
    Info: InfoCallout,
    Warning: WarningCallout,
    Success: SuccessCallout,
    Error: ErrorCallout,
    Note: NoteCallout,
    Tip: TipCallout,
    Check: CheckCallout,
    Launch: LaunchCallout,
    LaunchNote: LaunchCallout // legacy alias
};

// internal-use only
const INTERNAL_COMPONENTS = {
    ErrorBoundary,
    ElevenLabsWaveform,

    /**
     * deprecated but kept for backwards compatibility
     */
    Cards: CardGroup,
    CodeBlocks,
    Tabs: TabGroup
};

const HTML_COMPONENTS = {
    a: A,
    h1: (props: ComponentProps<"h1">) => HeadingRenderer(1, props),
    h2: (props: ComponentProps<"h2">) => HeadingRenderer(2, props),
    h3: (props: ComponentProps<"h3">) => HeadingRenderer(3, props),
    h4: (props: ComponentProps<"h4">) => HeadingRenderer(4, props),
    h5: (props: ComponentProps<"h5">) => HeadingRenderer(5, props),
    h6: (props: ComponentProps<"h6">) => HeadingRenderer(6, props),
    img: Image,
    iframe: IFrame,
    li: Li,
    ol: Ol,
    p: P,
    strong: Strong,
    table: Table,
    ul: Ul
};

const ALIASED_HTML_COMPONENTS = {
    A,
    H1: (props: ComponentProps<"h1">) => HeadingRenderer(1, props),
    H2: (props: ComponentProps<"h2">) => HeadingRenderer(2, props),
    H3: (props: ComponentProps<"h3">) => HeadingRenderer(3, props),
    H4: (props: ComponentProps<"h4">) => HeadingRenderer(4, props),
    H5: (props: ComponentProps<"h5">) => HeadingRenderer(5, props),
    H6: (props: ComponentProps<"h6">) => HeadingRenderer(6, props),
    Image,
    IFrame,
    Li,
    Ol,
    P,
    Strong,
    Table,
    Ul
};

export const MDX_COMPONENTS = {
    ...FERN_COMPONENTS,
    ...INTERNAL_COMPONENTS,
    ...HTML_COMPONENTS,
    ...ALIASED_HTML_COMPONENTS
} as unknown as MDXComponents;

export function createMdxComponents(jsxElements: string[]): MDXComponents {
    return {
        // spread in jsx elements that may be unsupported
        ...jsxElements.reduce<Record<string, () => ReactElement>>((acc, jsxElement) => {
            acc[jsxElement] = () => (
                <ErrorBoundaryFallback error={new Error(`Unsupported JSX tag: <${jsxElement} />`)} lang="en" />
            );
            return acc;
        }, {}),
        // then, spread in the supported components
        ...MDX_COMPONENTS
    };
}
