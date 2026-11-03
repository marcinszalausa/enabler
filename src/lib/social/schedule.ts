// Weekly posting slots ("Mondays at 10:00") in the customer's time zone.
// Times are handled as local wall-clock strings, "2026-11-02T10:00:00",
// which Zernio reads in the given time zone.

export type Slot = { day: number; time: string }; // day: 0 Sunday … 6 Saturday

export const DEFAULT_SLOTS: Slot[] = [
  { day: 1, time: "10:00" },
  { day: 3, time: "10:00" },
  { day: 5, time: "10:00" },
];

export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseSlots(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(
      (s): s is Slot =>
        Number.isInteger(s?.day) &&
        s.day >= 0 &&
        s.day <= 6 &&
        typeof s?.time === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time),
    )
    .map((s) => ({ day: s.day, time: s.time }))
    .filter((s) => {
      const key = `${s.day} ${s.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}

// The wall-clock time of an instant in a time zone, "YYYY-MM-DDTHH:MM:00".
export function toLocal(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`;
}

// The instant a local wall-clock time happens in a time zone.
export function fromLocal(local: string, timeZone: string) {
  const asUtc = Date.parse(`${local.slice(0, 16)}:00Z`);
  // The zone's offset at that moment; a second pass settles DST edges.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const shown = Date.parse(`${toLocal(new Date(guess), timeZone)}Z`);
    guess += asUtc - shown;
  }
  return new Date(guess);
}

// The next `count` free slots after `now`, skipping ones already taken
// (local strings) and anything in the next 10 minutes.
export function nextSlots(
  slots: Slot[],
  timeZone: string,
  taken: Set<string>,
  count: number,
  now = new Date(),
) {
  const found: string[] = [];
  if (slots.length === 0) return found;
  const earliest = toLocal(new Date(now.getTime() + 10 * 60_000), timeZone);
  const today = Date.parse(`${earliest.slice(0, 10)}T00:00:00Z`);
  // A year of weeks is plenty even with a crowded queue.
  for (let d = 0; d < 366 && found.length < count; d++) {
    const date = new Date(today + d * 86_400_000);
    const day = date.getUTCDay();
    const ymd = date.toISOString().slice(0, 10);
    for (const slot of slots) {
      if (slot.day !== day) continue;
      const local = `${ymd}T${slot.time}:00`;
      if (local <= earliest || taken.has(local)) continue;
      found.push(local);
      if (found.length === count) break;
    }
  }
  return found;
}

// "Mon, Nov 2, 10:00" for a local wall-clock string, in the page's language.
export function formatLocal(local: string, locale: string) {
  return new Date(`${local.slice(0, 16)}:00Z`).toLocaleString(locale, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
