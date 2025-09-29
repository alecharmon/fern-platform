import "server-only";

import React from "react";

import { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { FernDropdown } from "@fern-docs/components";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";

import { PageHeader } from "@/components/PageHeader";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { PlaygroundKeyboardTrigger } from "@/components/playground/PlaygroundKeyboardTrigger";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import { MdxSerializer } from "@/server/mdx-serializer";

import { TypeDefinitionRoot } from "../type-definitions/TypeDefinitionContext";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { EndpointContentCodeSnippets } from "./EndpointContentCodeSnippets";
import { EndpointContentLeft } from "./EndpointContentLeft";
import { EndpointContextProvider } from "./EndpointContext";
import { EndpointUrlWithPlaygroundBaseUrl } from "./EndpointUrlWithPlaygroundBaseUrl";

function getAvailabilityBadge(
  endpoint: EndpointContext["endpoint"],
  node: EndpointContext["node"]
) {
  const availability = endpoint.availability ?? node.availability;
  return availability ? (
    <AvailabilityBadge availability={availability} rounded />
  ) : null;
}

export async function EndpointContent({
  serialize,
  showErrors,
  showAuth,
  context,
  breadcrumb,
  action,
  bottomNavigation,
  hideFeedback,
  pageActionOptions,
}: {
  serialize: MdxSerializer;
  showErrors: boolean;
  showAuth: boolean;
  context: EndpointContext;
  breadcrumb: readonly FernNavigation.BreadcrumbItem[];
  action?: React.ReactNode;
  bottomNavigation?: React.ReactNode;
  hideFeedback: boolean;
  pageActionOptions?: FernDropdown.PageActionOption[];
}) {
  const { node, endpoint, types } = context;

  return (
    <EndpointContextProvider endpoint={endpoint}>
      <ReferenceLayout
        header={
          <PageHeader
            serialize={serialize}
            breadcrumb={breadcrumb}
            title={node.title}
            action={action}
            tags={getAvailabilityBadge(endpoint, node)}
            slug={node.slug}
            pageActionOptions={pageActionOptions}
          >
            <EndpointUrlWithPlaygroundBaseUrl
              endpoint={endpoint}
              className={
                endpoint.protocol?.type === "grpc" ? "hidden" : "hidden lg:flex"
              }
            />
          </PageHeader>
        }
        aside={
          <EndpointContentCodeSnippets
            endpoint={endpoint}
            showErrors={showErrors}
            node={node}
          />
        }
        reference={
          <TypeDefinitionRoot types={types} slug={node.slug}>
            <TypeDefinitionSlotsServer types={types}>
              <EndpointContentLeft
                context={context}
                showAuth={showAuth}
                showErrors={showErrors}
              />
            </TypeDefinitionSlotsServer>
          </TypeDefinitionRoot>
        }
        footer={
          <FooterLayout
            bottomNavigation={bottomNavigation}
            hideFeedback={hideFeedback}
          />
        }
      >
        <PlaygroundKeyboardTrigger />
        <MdxServerComponentProseSuspense mdx={endpoint.description} />
      </ReferenceLayout>
    </EndpointContextProvider>
  );
}
