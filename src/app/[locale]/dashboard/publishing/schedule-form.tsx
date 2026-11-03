"use client";

import { useActionState, useState } from "react";
import { saveSchedule, type ScheduleState } from "./actions";
import { useBrowserTimeZone, useTimeZones } from "../time-zone";
import type { Slot } from "@/lib/social/schedule";
import { useI18n } from "@/i18n/client";

const initialState: ScheduleState = { error: null, saved: false };

const field =
  "rounded-md border border-line-strong bg-raised px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20";

// Weekly posting times, the time zone they're in, and Autopilot.
export function ScheduleForm({
  timeZone,
  slots: savedSlots,
  autopilot,
  autopilotAccounts,
  accounts,
}: {
  // null until saved once: the browser's own zone is suggested.
  timeZone: string | null;
  slots: Slot[];
  autopilot: boolean;
  autopilotAccounts: string[];
  accounts: { id: string; label: string }[];
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveSchedule, initialState);
  const [slots, setSlots] = useState<Slot[]>(savedSlots);
  const [auto, setAuto] = useState(autopilot);
  const browserZone = useBrowserTimeZone();
  const zones = useTimeZones();
  const zone = timeZone ?? browserZone;

  const update = (i: number, change: Partial<Slot>) =>
    setSlots(slots.map((s, j) => (j === i ? { ...s, ...change } : s)));

  return (
    <form action={action} className="flex flex-col gap-5 text-sm">
      <input type="hidden" name="slots" value={JSON.stringify(slots)} />

      <label className="flex flex-col gap-1.5 sm:max-w-xs">
        <span className="font-medium">{t.publish.timeZone}</span>
        <select
          name="timeZone"
          // Remount once the browser's list arrives, so the value sticks.
          key={`${zones.length}-${zone}`}
          defaultValue={zone}
          className={field}
        >
          {(zones.includes(zone) ? zones : [zone, ...zones]).map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        {slots.length === 0 && (
          <p className="text-muted">{t.publish.noSlots}</p>
        )}
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={slot.day}
              onChange={(e) => update(i, { day: Number(e.target.value) })}
              className={`${field} min-w-0 flex-1 sm:flex-none`}
              aria-label={t.publish.day}
            >
              {t.publish.days.map((name, day) => (
                <option key={day} value={day}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={slot.time}
              required
              onChange={(e) => update(i, { time: e.target.value.slice(0, 5) })}
              className={`${field} min-w-0`}
              aria-label={t.publish.time}
            />
            <button
              type="button"
              onClick={() => setSlots(slots.filter((_, j) => j !== i))}
              className="shrink-0 px-2 text-muted hover:text-danger"
            >
              {t.publish.remove}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSlots([
              ...slots,
              {
                day: ((slots.at(-1)?.day ?? 0) + 1) % 7,
                time: slots.at(-1)?.time ?? "10:00",
              },
            ])
          }
          className="self-start font-medium text-accent"
        >
          + {t.publish.addTime}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="autopilot"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span>
            <span className="font-medium">{t.publish.autopilot}</span>
            <span className="mt-0.5 block text-muted">
              {t.publish.autopilotHelp}
            </span>
          </span>
        </label>
        {/* Hidden, not removed, so the picks survive switching it off. */}
        <fieldset hidden={!auto} className="flex flex-wrap gap-2 pl-7">
          <legend className="sr-only">{t.publish.to}</legend>
          {accounts.length === 0 && (
            <p className="text-muted">{t.publish.noAccounts}</p>
          )}
          {accounts.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent"
            >
              <input
                type="checkbox"
                name="autopilotAccounts"
                value={a.id}
                defaultChecked={autopilotAccounts.includes(a.id)}
                className="sr-only"
              />
              {a.label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-lg px-4 py-2 font-medium"
        >
          {pending ? t.app.saving : t.publish.saveSchedule}
        </button>
        {state.saved && !pending && (
          <p role="status" className="text-ok">
            {t.publish.saved}
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-danger">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
