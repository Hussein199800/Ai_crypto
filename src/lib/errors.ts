/** خطأ بحالة HTTP — لا يعتمد على next/server ليُستخدم في الخادم والمتصفح */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
