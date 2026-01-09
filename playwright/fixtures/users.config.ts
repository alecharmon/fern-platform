export type UserRole = "admin" ; //TODO: add member and viewer when we have test users for them

export interface TestUser {
  email: string;
  password: string;
  role: UserRole;
}

const TEST_USER_EMAILS: Record<UserRole, string> = {
  admin: "ci-admin@buildwithfern.com",
};

export function getTestUser(role: UserRole): TestUser | undefined {
  const password = process.env.FERN_CI_AUTOMATED_TESTING;
  if (!password) {
    return undefined;
  }

  const email = TEST_USER_EMAILS[role];
  if (!email) {
    return undefined;
  }

  return { email, password, role };
}
