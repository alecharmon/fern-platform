"use server";

import { FdrAPI } from "@fern-api/fdr-sdk";
import {
  VisualEditorDocument,
  visualEditorStorage,
} from "@fern-api/visual-editor-server";
import { branchMatchesUser } from "@fern-docs/components/navigation/local-storage";

import { DocsUrl } from "@/utils/types";

import { getCurrentSession } from "../../auth0/getCurrentSession";
import { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";

/**
 * Gets relevant branches for a user by filtering all branches received from NavigationStorage
 * to only includes branches that match the user's branch naming format (date-username-shortSubHash-randomHash)
 *
 * @param userId - Auth0 user ID (sub) for branch filtering
 * @returns Array of branch names, sorted by relevance
 */
export async function getRelevantUserBranchesForSite(
  orgName: Auth0OrgName,
  docsUrl: DocsUrl,
  branchNamesInClientStorage: string[]
): Promise<string[]> {
  try {
    const session = await getCurrentSession();
    if (session == null) {
      return [];
    }
    await assertUserHasOrganizationAccess({
      userId: session.user.sub,
      orgName,
    });

    // Filter local branches to only include branches that match the user's branch naming format
    const userBranches = branchNamesInClientStorage.filter((branchName) =>
      branchMatchesUser(branchName, session.user.sub)
    );

    // Get the branch documents from the database
    const branchDocuments =
      await visualEditorStorage.getDocumentsForBranches(userBranches);

    // Filter the branch documents to only include branches that match the site and org
    const filteredBranchesForSiteAndOrg = branchDocuments
      .filter(
        (document) =>
          document != null &&
          document.domain === docsUrl &&
          document.data.orgId === FdrAPI.OrgId(orgName)
      )
      .filter((document) => document != null);

    // Sort by date (newest first)
    const sortedBranches = filteredBranchesForSiteAndOrg.sort(
      (a: VisualEditorDocument, b: VisualEditorDocument) => {
        const dateA = a.updatedAt;
        const dateB = b.updatedAt;

        return dateB.getTime() - dateA.getTime();
      }
    );

    return sortedBranches.map((document) => document.branchName);
  } catch (error) {
    console.warn("Failed to get relevant branches from stored data:", error);
    return [];
  }
}
