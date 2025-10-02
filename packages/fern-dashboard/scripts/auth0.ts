#!/usr/bin/env tsx
/* eslint-disable turbo/no-undeclared-env-vars */
import { ManagementClient } from "auth0";
import dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, "../.env.local") });

async function getOrgsForUser(userId: string) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    throw new Error(
      "Missing required Auth0 environment variables: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET"
    );
  }

  const management = new ManagementClient({
    domain,
    clientId,
    clientSecret,
  });

  try {
    const organizations = await management.users.getUserOrganizations({
      id: userId,
    });

    console.log(`Organizations for user ${userId}:`);
    console.log(JSON.stringify(organizations.data, null, 2));
  } catch (error) {
    console.error("Error fetching organizations:", error);
    throw error;
  }
}

// Parse command line arguments
const command = process.argv[2];
const userId = process.argv[3];

if (command === "get-orgs-for-user") {
  if (!userId) {
    console.error("Usage: tsx scripts/auth0.ts get-orgs-for-user <user-id>");
    process.exit(1);
  }
  getOrgsForUser(userId).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
} else {
  console.error(
    `Unknown command: ${command}\n\nAvailable commands:\n  get-orgs-for-user <user-id>`
  );
  process.exit(1);
}
