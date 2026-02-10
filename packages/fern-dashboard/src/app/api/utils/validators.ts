import { z } from "zod";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

export const userIdValidator = z.string().refine((orgName: string): orgName is Auth0UserID => true);

export const orgNameValidator = z.string().refine((orgName: string): orgName is Auth0OrgName => true);

export const docsUrlValidator = z.string().refine((docsUrl: string): docsUrl is DocsUrl => true);
