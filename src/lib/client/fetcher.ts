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

export async function apiGet<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch {
    throw new ApiClientError("تعذر الاتصال بالخادم. تحقق من الاتصال بالإنترنت.", 0);
  }
  return parse<T>(res);
}

export async function apiSend<T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
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
