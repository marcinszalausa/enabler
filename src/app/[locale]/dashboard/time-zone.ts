"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

// The visitor's time zone ("Europe/Warsaw"); UTC while rendering on the server.
export function useBrowserTimeZone() {
  return useSyncExternalStore(
    noSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}

let zones: string[] | null = null;
const noZones: string[] = [];

// Every time zone the browser knows; none while rendering on the server.
export function useTimeZones() {
  return useSyncExternalStore(
    noSubscribe,
    () => (zones ??= Intl.supportedValuesOf("timeZone")),
    () => noZones,
  );
}
