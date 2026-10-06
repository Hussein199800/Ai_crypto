import bcrypt from "bcryptjs";

const COST = 12;

/** تجزئة bcrypt — لا تُخزَّن كلمات المرور بشكل مكشوف أبدًا */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummy: string | null = null;
/** تجزئة وهمية لمقارنة بزمن ثابت تقريبًا عند عدم وجود المستخدم (تقليل كشف وجود الحساب) */
export function dummyHash(): string {
  dummy ??= bcrypt.hashSync("cryptoscope-dummy-password", COST);
  return dummy;
}
