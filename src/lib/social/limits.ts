// How many social accounts a workspace may connect, by plan (workspaces.plan).
// Zernio bills per connected account, so the cap keeps each plan's cost
// predictable. Unknown plans get the free cap.
export const ACCOUNT_LIMITS: Record<string, number> = {
  free: 1,
  starter: 3,
  plus: 5,
  growth: 10,
};

export function accountLimit(plan: string | null | undefined) {
  return ACCOUNT_LIMITS[plan ?? "free"] ?? ACCOUNT_LIMITS.free;
}
