import { createHash, randomBytes } from "node:crypto";

/** رمز عشوائي آمن يُرسل للمستخدم، وتُخزَّن تجزئته فقط في قاعدة البيانات */
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
