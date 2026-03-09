export type UserRole = "admin" ; //TODO: add member and viewer when we have test users for them

export interface TestUser {
  email: string;
  password: string;
  role: UserRole;
}

export function getTestUser(role: UserRole): TestUser | undefined {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    return undefined;
  }

  return { email, password, role };
}
