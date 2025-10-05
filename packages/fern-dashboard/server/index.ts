import type { PrismaClient } from "@prisma/client";

import { DocsWorkspaceDao } from "./daos/docs-workspace";
import { UserDao } from "./daos/user";

export class DashboardDao {
    private workspaceDao: DocsWorkspaceDao;
    private userDao: UserDao;
    // gitRepoDao: GitRepoDao;

    constructor(prisma: PrismaClient) {
        this.workspaceDao = new DocsWorkspaceDao(prisma);
        this.userDao = new UserDao(prisma);
    }

    public workspace(): DocsWorkspaceDao {
        return this.workspaceDao;
    }

    public user(): UserDao {
        return this.userDao;
    }
}
