import { STATIC_MODE } from "@/lib/static-mode";

/** خطأ API بعربية واضحة لعرضه للمستخدم */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* استجابة بدون JSON */
  }
  if (!res.ok) {
    const b = body as { error?: string; fields?: Record<string, string> } | null;
    const fallback =
      res.status === 401 ? "يجب تسجيل الدخول" : res.status === 429 ? "طلبات كثيرة، حاول لاحقًا" : res.status >= 500 ? "خطأ في الخادم أو مزود البيانات" : "تعذر تنفيذ الطلب";
    throw new ApiClientError(b?.error ?? fallback, res.status, b?.fields);
  }
  return body as T;
}

/** في النسخة الثابتة تُنفَّذ طلبات /api داخل المتصفح بدل الخادم */
async function staticRequest<T>(method: string, url: string, body?: unknown): Promise<T> {
  const { localRequest, LocalApiError } = await import("@/lib/static/local-api");
  try {
    return (await localRequest(method, url, body)) as T;
  } catch (e) {
    if (e instanceof LocalApiError) throw new ApiClientError(e.message, e.status);
    throw new ApiClientError("حدث خطأ غير متوقع", 500);
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  if (STATIC_MODE) return staticRequest<T>("GET", url);
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch {
    throw new ApiClientError("تعذر الاتصال بالخادم. تحقق من الاتصال بالإنترنت.", 0);
  }
  return parse<T>(res);
}

export async function apiSend<T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  if (STATIC_MODE) return staticRequest<T>(method, url, body);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("تعذر الاتصال بالخادم. تحقق من الاتصال بالإنترنت.", 0);
  }
  return parse<T>(res);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "حدث خطأ غير متوقع";
}
