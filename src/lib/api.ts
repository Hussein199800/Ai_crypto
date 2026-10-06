import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logError } from "@/lib/logger";
import { NotSupportedError, ProviderError, UnknownSymbolError } from "@/lib/providers/errors";
import { firstError } from "@/lib/validators";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>, headers?: HeadersInit) {
  return NextResponse.json({ error: message, ...extra }, { status, headers });
}

/** تحويل الأخطاء إلى استجابات عربية واضحة دون كشف تفاصيل داخلية */
export function handleApiError(e: unknown, context: string) {
  if (e instanceof HttpError) return jsonError(e.status, e.message, e.code ? { code: e.code } : undefined);
  if (e instanceof ZodError) return jsonError(400, firstError(e));
  if (e instanceof UnknownSymbolError) return jsonError(404, "الرمز غير مدعوم");
  if (e instanceof NotSupportedError) return jsonError(422, "هذه البيانات غير متاحة لهذا الأصل");
  if (e instanceof ProviderError) {
    logError(context, e);
    return jsonError(503, "تعذر جلب البيانات من مزود البيانات حاليًا. حاول لاحقًا.");
  }
  logError(context, e);
  return jsonError(500, "حدث خطأ غير متوقع. حاول مرة أخرى.");
}

/**
 * حماية CSRF للطلبات المعدِّلة: يجب أن يطابق Origin (أو Referer) مضيف الطلب.
 * تُضاف هذه الطبقة فوق ملفات تعريف الارتباط SameSite=Lax.
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "طلب مرفوض (مصدر غير معروف)", "CSRF");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "طلب مرفوض (مصدر غير صالح)", "CSRF");
  }
  if (originHost !== host) throw new HttpError(403, "طلب مرفوض (مصدر مختلف)", "CSRF");
}

export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 32_000) throw new HttpError(413, "حجم الطلب كبير جدًا");
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "صيغة الطلب غير صالحة (JSON)");
  }
}

export function searchParamsObject(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}
