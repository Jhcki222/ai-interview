export async function readInitialAuthUser<User>(
  read: () => Promise<{ data: { user: User | null }; error?: unknown }>,
): Promise<User | null> {
  try {
    const result = await read();
    return result.error ? null : result.data.user;
  } catch {
    return null;
  }
}
export function canExposeMemberData(
  viewerId: string | null,
  loadedOwnerId: string | null,
  loading: boolean,
) {
  return !loading && !!viewerId && viewerId === loadedOwnerId;
}
export function isCurrentMemberRequest(
  requestOwner: string,
  currentOwner: string | null,
  requestVersion: number,
  currentVersion: number,
) {
  return requestOwner === currentOwner && requestVersion === currentVersion;
}
