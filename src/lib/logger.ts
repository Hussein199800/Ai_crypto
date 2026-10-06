/**
 * تسجيل الأخطاء دون تسريب أسرار: يُحذف أي نص يشبه مفاتيح API أو كلمات المرور.
 */
const SECRET_PATTERNS = [
  /(api[_-]?key|secret|token|password|authorization|auth_token)(["'\s:=]+)([^\s"'&,]+)/gi,
  /postgres(ql)?:\/\/[^\s]+/gi,
];

export function redact(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) out = out.replace(re, (_m, k, sep) => (sep ? `${k}${sep}[REDACTED]` : "[REDACTED]"));
  return out;
}

export function logError(context: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error(`[CryptoScope:${context}] ${redact(msg)}`);
}

export function logInfo(context: string, msg: string) {
  console.info(`[CryptoScope:${context}] ${redact(msg)}`);
}
