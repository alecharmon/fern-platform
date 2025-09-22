"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { ApiDefinition } from "@fern-api/fdr-sdk";

import { useProgrammingLanguage } from "@/state/language";

export function QueryParamProcessor() {
  const searchParams = useSearchParams();
  const [_, setSelectedLanguage] = useProgrammingLanguage();

  useEffect(() => {
    if (searchParams.get("language")) {
      setSelectedLanguage(
        searchParams.get("language") as ApiDefinition.Language
      );
    }
  }, [searchParams, setSelectedLanguage]);
}
