import "server-only";
import { cacheLife } from "next/cache";

// What a visitor's country pays in, for showing an approximate local price
// next to the dollar one. Only currencies we have a daily rate for; anywhere
// else sees dollars alone. Checkout shows the exact amount.
const COUNTRY_CURRENCY: Record<string, string> = {
  ...spread(
    "EUR",
    "AT BE BG CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK MC SM VA AD ME XK",
  ),
  ...spread("CHF", "CH LI"),
  PL: "PLN",
  GB: "GBP",
  CZ: "CZK",
  RO: "RON",
  HU: "HUF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  IS: "ISK",
  TR: "TRY",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  HK: "HKD",
  IN: "INR",
  ID: "IDR",
  MY: "MYR",
  PH: "PHP",
  SG: "SGD",
  TH: "THB",
  IL: "ILS",
  BR: "BRL",
  MX: "MXN",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  ZA: "ZAR",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  BH: "BHD",
  OM: "OMR",
  JO: "JOD",
};

// Gulf currencies are fixed to the dollar, and the ECB doesn't list them.
const PEGGED: Record<string, number> = {
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  BHD: 0.376,
  OMR: 0.3845,
  JOD: 0.709,
};

function spread(currency: string, countries: string) {
  return Object.fromEntries(countries.split(" ").map((c) => [c, currency]));
}

// The European Central Bank's daily reference rates, per US dollar.
async function usdRates(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("days");
  const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD");
  if (!res.ok) throw new Error(`Exchange rates: HTTP ${res.status}`);
  const { rates } = (await res.json()) as { rates: Record<string, number> };
  return rates;
}

export async function localCurrency(
  country: string | null,
): Promise<{ currency: string; rate: number } | null> {
  const currency = country && COUNTRY_CURRENCY[country.toUpperCase()];
  if (!currency) return null;
  if (PEGGED[currency]) return { currency, rate: PEGGED[currency] };
  try {
    const rate = (await usdRates())[currency];
    return rate ? { currency, rate } : null;
  } catch (err) {
    console.error("exchange rates failed", err);
    return null;
  }
}
