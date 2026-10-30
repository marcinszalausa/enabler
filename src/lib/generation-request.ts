// Retain receipts for captured form submissions, including queued double-clicks.
// Changing options after an uncertain response creates a separate request.
export class GenerationRequest {
  private requests = new Map<string, string>();
  private usedTokens = new Set<string>();

  forForm(form: FormData): string {
    const token = String(form.get("requestId") ?? "");
    const input = JSON.stringify(
      [...form.entries()]
        .filter(([name]) => name !== "requestId" && !name.startsWith("$ACTION_"))
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const key = JSON.stringify([token, input]);
    const existing = this.requests.get(key);
    if (existing) return existing;
    const id = token && !this.usedTokens.has(token) ? token : crypto.randomUUID();
    this.usedTokens.add(token);
    this.requests.set(key, id);
    return id;
  }
}
