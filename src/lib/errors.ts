// An error whose message is safe and useful to show to the user.
export class UserError extends Error {}

export function userMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof UserError ? err.message : fallback;
}
