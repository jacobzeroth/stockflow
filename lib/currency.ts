export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "AED", label: "UAE Dirham (د.إ)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
  { code: "SGD", label: "Singapore Dollar (S$)" },
  { code: "ZAR", label: "South African Rand (R)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
] as const;

export const DEFAULT_CURRENCY = "INR";

export function isSupportedCurrency(value: string): boolean {
  return CURRENCIES.some((currency) => currency.code === value);
}

export function currencyLabel(code: string): string {
  return CURRENCIES.find((currency) => currency.code === code)?.label ?? code;
}

export function localeForCurrency(code: string): string {
  return code === "INR" ? "en-IN" : "en-GB";
}
