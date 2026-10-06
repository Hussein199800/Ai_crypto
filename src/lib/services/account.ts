import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { appUrl, sendMail } from "@/lib/mailer";
import { generateToken, hashToken } from "@/lib/security/tokens";
import { getEnv } from "@/lib/env";

const VERIFY_TTL_MS = 24 * 60 * 60_000;
const RESET_TTL_MS = 60 * 60_000;

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // رسالة عامة لا تكشف وجود الحساب بشكل مباشر، مع إعادة إرسال رابط التأكيد إن لم يُؤكَّد
    if (!existing.emailVerified) await sendVerificationEmail(existing.email);
    return { created: false };
  }
  const passwordHash = await hashPassword(input.password);
  const requireVerify = getEnv().REQUIRE_EMAIL_VERIFICATION;
  await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, emailVerified: requireVerify ? null : new Date() },
  });
  if (requireVerify) await sendVerificationEmail(input.email);
  return { created: true };
}

export async function sendVerificationEmail(email: string) {
  const { token, hash } = generateToken();
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({ data: { identifier: email, token: hash, expires: new Date(Date.now() + VERIFY_TTL_MS) } });
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  await sendMail(email, "تأكيد بريدك الإلكتروني — CryptoScope AI", "مرحبًا، لتأكيد بريدك الإلكتروني افتح الرابط التالي (صالح 24 ساعة):", link);
}

export async function verifyEmail(token: string) {
  const hash = hashToken(token);
  const row = await prisma.verificationToken.findUnique({ where: { token: hash } });
  if (!row || row.expires < new Date()) throw new HttpError(400, "رابط التأكيد غير صالح أو منتهي الصلاحية");
  await prisma.$transaction([
    prisma.user.updateMany({ where: { email: row.identifier }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { token: hash } }),
  ]);
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // نعيد نفس الاستجابة سواء وُجد الحساب أم لا
  if (!user) return;
  const { token, hash } = generateToken();
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
  const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  await sendMail(email, "استعادة كلمة المرور — CryptoScope AI", "لإعادة تعيين كلمة المرور افتح الرابط التالي (صالح ساعة واحدة). إن لم تطلب ذلك فتجاهل الرسالة.", link);
}

export async function resetPassword(token: string, password: string) {
  const hash = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new HttpError(400, "رابط الاستعادة غير صالح أو منتهي الصلاحية");
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash, emailVerified: new Date() } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);
}
