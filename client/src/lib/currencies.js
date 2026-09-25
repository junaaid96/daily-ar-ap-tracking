// Currency catalogue for pickers: every ISO 4217 code the browser can format,
// with a localized name and symbol, plus a short "popular" list pinned on top.

export const POPULAR = ['USD', 'EUR', 'GBP', 'BDT', 'INR', 'PKR', 'AED', 'SAR', 'MYR', 'SGD', 'CAD', 'AUD', 'JPY', 'CNY'];

const FALLBACK = [...POPULAR, 'NGN', 'KES', 'IDR', 'TRY', 'BRL', 'ZAR', 'CHF', 'SEK', 'NZD', 'THB', 'PHP', 'NPR', 'LKR', 'QAR', 'KWD', 'EGP'];

let cache;
export function allCurrencies() {
  if (cache) return cache;
  let codes = FALLBACK;
  try { codes = Intl.supportedValuesOf('currency'); } catch { /* older browsers */ }
  let names;
  try { names = new Intl.DisplayNames(undefined, { type: 'currency' }); } catch { names = null; }
  cache = codes.map((code) => ({ code, name: names?.of(code) || code, symbol: symbolFor(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}

export function symbolFor(code) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find((p) => p.type === 'currency')?.value || code;
  } catch {
    return code;
  }
}

export function currencyName(code) {
  return allCurrencies().find((c) => c.code === code)?.name || code;
}
