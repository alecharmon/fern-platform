export type UserRole = "admin" | "member";

export interface TestUser {
  email: string;
  password: string;
  role: UserRole;
}

const TEST_USERS: Record<UserRole, TestUser> = {
  admin: {
    email: "alice@acme.com",
    password: "buildwithfern",
    role: "admin",
  },
  member: {
    email: "bob@acme.com",
    password: "buildwithfern",
    role: "member",
  },
};

export function getTestUser(role: UserRole): TestUser {
  return TEST_USERS[role];
}
