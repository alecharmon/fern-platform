import type { PrismaClient } from "@prisma/client";

export class UserDao {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    // async createUser(user: User) {
    //   await this.prisma.user.create({
    //     data: user,
    //   });
    // }
}
