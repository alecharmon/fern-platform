/**
 * Adds super_user role to all users in the Fern org with @buildwithfern.com emails.
 *
 * Usage: npx tsx packages/fern-dashboard/scripts/add-super-user-role.ts [--dry-run=false]
 *
 * Options:
 *   --dry-run        Dry run mode (default: true)
 *   --dry-run=false  Actually make changes
 *
 * Required environment variables:
 *   AUTH0_DOMAIN
 *   AUTH0_CLIENT_ID
 *   AUTH0_CLIENT_SECRET
 */

import { ManagementClient } from "auth0";

const THROTTLE_MS = 100;
const DRY_RUN = !process.argv.includes("--dry-run=false");

// Fern organization ID
const FERN_ORG_ID = "org_KACCpkwKZQqXY0hp";

// super_user role ID
const SUPER_USER_ROLE_ID = "rol_aOLlwiCi0uyRGgSE";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getManagementClient(): ManagementClient {
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;

    if (!domain || !clientId || !clientSecret) {
        throw new Error("Missing required AUTH0 environment variables");
    }

    return new ManagementClient({
        domain,
        clientId,
        clientSecret
    });
}

async function main() {
    if (DRY_RUN) {
        console.log("DRY RUN MODE - No changes will be made\n");
    }

    console.log("Initializing Auth0 Management Client...");
    const client = getManagementClient();

    console.log(`\nFetching members of Fern org (${FERN_ORG_ID})...\n`);

    let totalProcessed = 0;
    let totalUpdated = 0;

    await sleep(THROTTLE_MS);
    const membersPage = await client.organizations.members.list(FERN_ORG_ID, {
        per_page: 50
    });

    for await (const member of membersPage) {
        totalProcessed++;
        console.log(`\n- ${member.email}`);
        console.log(`  User ID: ${member.user_id}`);

        if (DRY_RUN) {
            console.log("  [DRY RUN] Would add super_user role (user-level + org-level)");
            totalUpdated++;
        } else {
            await sleep(THROTTLE_MS);
            await client.users.roles.assign(member.user_id!, {
                roles: [SUPER_USER_ROLE_ID]
            });
            console.log("  Added super_user role (user-level)");

            await sleep(THROTTLE_MS);
            await client.organizations.members.roles.assign(FERN_ORG_ID, member.user_id!, {
                roles: [SUPER_USER_ROLE_ID]
            });
            console.log("  Added super_user role (org-level)");
            totalUpdated++;
        }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("Complete!");
    console.log(`  @buildwithfern.com users processed: ${totalProcessed}`);
    console.log(`  Users ${DRY_RUN ? "would be " : ""}updated: ${totalUpdated}`);
}

main().catch((error: unknown) => {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
});
