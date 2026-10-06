/** مفضلة الزائر غير المسجل — تُحفظ في المتصفح فقط */
const KEY = "cryptoscope:watchlist:v1";

export function readLocalWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string" && /^[A-Z0-9.]{1,12}$/.test(x)).slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function writeLocalWatchlist(symbols: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(symbols.slice(0, 50)));
    window.dispatchEvent(new Event("cryptoscope:watchlist"));
  } catch {
    /* التخزين غير متاح */
  }
}
