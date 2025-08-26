const DELIMITER = "&";

export function createDelimitedRolesetString(roleset: string[]): string {
  const sortedRoleset = [...roleset].sort();
  return sortedRoleset.join(DELIMITER);
}
