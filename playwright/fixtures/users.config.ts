export type UserRole = "admin" ; //TODO: add member and viewer when we have test users for them

export interface TestUser {
  email: string;
  password: string;
  role: UserRole;
}

export function getTestUser(role: UserRole): TestUser {
  return {
    email: process.env.E2E_TEST_EMAIL || "alice@acme.com",
    password: process.env.E2E_TEST_PASSWORD || "buildwithfern",
    role,
  };
}
