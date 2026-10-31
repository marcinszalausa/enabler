// Best-effort per-instance budgets; no persistent visitor identifiers.
export class PreviewBudget {
  private users = new Map<string, number>();
  private window = 0;
  private total = 0;
  take(key: string, now = Date.now()): boolean {
    if (now - this.window >= 60000) { this.window = now; this.total = 0; this.users.clear(); }
    const count = this.users.get(key) ?? 0;
    if (this.total >= 40 || count >= 6) return false;
    this.users.set(key, count + 1); this.total++;
    return true;
  }
}
