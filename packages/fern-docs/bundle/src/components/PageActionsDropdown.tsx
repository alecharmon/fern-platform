"use client";

import { ParamValue } from "next/dist/server/request/params";
import { useParams } from "next/navigation";
import { useState } from "react";

import { useSetAtom } from "jotai";
import { Check, ChevronDown, Copy } from "lucide-react";

import { isSelfHosted } from "@fern-api/docs-server";
import { FernButton, FernDropdown } from "@fern-docs/components";

import { capturePosthogEventInternal } from "@/components/analytics/posthog";
import { useIsAskAiEnabled } from "@/state/search";
import { searchPanelOpenAtom, useSetPageContext } from "@/state/search-panel";

import {
  CopyPageOption,
  OpenAISearchOption,
  OpenWithLLM,
  ViewAsMarkdownOption,
} from "./PageActionsDropdownOptions";

export function PageActionsDropdown({ markdown }: { markdown: string }) {
  const [showCopied, setShowCopied] = useState<boolean>(false);
  const { domain, slug } = useParams();

  // this is used to open the search dialog, and then AI chat
  // const setSearchDialogState = useSetAtom(searchDialogOpenAtom);
  const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
  const setPageContext = useSetPageContext();

  const copyOption = CopyPageOption();
  const viewAsMarkdownOption = ViewAsMarkdownOption();
  const openAISearchOption = OpenAISearchOption();

  let options: FernDropdown.Option[] = [copyOption];
  if (useIsAskAiEnabled()) {
    options.push({ type: "separator" } as FernDropdown.SeparatorOption);
    options.push(openAISearchOption);
  } else if (!isSelfHosted()) {
    options.push({ type: "separator" } as FernDropdown.SeparatorOption);
    options.push(OpenWithLLM({ domain, slug, llm: "ChatGPT" }));
    options.push({ type: "separator" } as FernDropdown.SeparatorOption);
    options.push(OpenWithLLM({ domain, slug, llm: "Claude" }));
  }
  options = options.concat([
    { type: "separator" } as FernDropdown.SeparatorOption,
    viewAsMarkdownOption,
  ]);

  const handleValueChange = async (value: string) => {
    if (value === "copy-page") {
      if (markdown) {
        await navigator.clipboard.writeText(markdown).then(() => {
          capturePosthogEventInternal("page_actions_dropdown", {
            type: "copy-option",
            page_location: window.location.pathname,
          });

          setShowCopied(true);

          setTimeout(() => {
            setShowCopied(false);
          }, 2000);
        });
      }
    } else if (value === "open-ai-search") {
      const pageContext = {
        title: document.title,
        url: constructPageUrl(domain, slug),
      };
      setPageContext(pageContext);
      setSearchPanelState(true);
      capturePosthogEventInternal("page_actions_dropdown", {
        type: "ai-search",
        page_location: window.location.pathname,
      });
    } else if (value === "view-as-markdown") {
      capturePosthogEventInternal("page_actions_dropdown", {
        type: "markdown",
        page_location: window.location.pathname,
      });
    }
  };

  return (
    <div className="fern-page-actions">
      <FernButton
        variant="minimal"
        className="w-fit rounded-r-none px-2"
        onClick={() => {
          capturePosthogEventInternal("page_actions_dropdown", {
            type: "copy-button",
            page_location: window.location.pathname,
          });
          void handleValueChange("copy-page");
        }}
      >
        {showCopied ? (
          <div className="flex items-center gap-2">
            <Check className="size-icon" />
            <span>Copied!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Copy className="size-icon" />
            <span>Copy page</span>
          </div>
        )}
      </FernButton>
      <FernDropdown
        options={options}
        onValueChange={(value) => void handleValueChange(value)}
        dropdownMenuElement={<a target="_blank" rel="noopener noreferrer" />}
      >
        <FernButton
          variant="minimal"
          className="rounded-l-none px-2"
          onClick={() => {
            capturePosthogEventInternal("page_actions_dropdown", {
              type: "open",
              page_location: window.location.pathname,
            });
          }}
        >
          <ChevronDown className="size-icon" />
        </FernButton>
      </FernDropdown>
    </div>
  );
}

function constructPageUrl(domain: ParamValue, slug: ParamValue) {
  return `https://${domain as string}${decodeURIComponent(slug as string)}`;
}
