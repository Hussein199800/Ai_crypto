import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";

export function appUrl(path = "/"): string {
  const base = (getEnv().NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

/**
 * إرسال بريد عبر SMTP_URL. أثناء التطوير وبدون SMTP يُطبع الرابط في سجل الخادم.
 * في الإنتاج بدون SMTP لا يُطبع الرابط (لأنه سرّي) ويُسجَّل تحذير فقط.
 */
export async function sendMail(to: string, subject: string, text: string, link?: string): Promise<boolean> {
  const env = getEnv();
  if (!env.SMTP_URL) {
    if (env.NODE_ENV !== "production") {
      console.info(`\n[CryptoScope:mail] إلى: ${to}\nالموضوع: ${subject}\n${text}\n${link ?? ""}\n`);
    } else {
      logInfo("mail", "لم يُعدّ SMTP_URL — تعذر إرسال البريد");
    }
    return false;
  }
  try {
    const transport = nodemailer.createTransport(env.SMTP_URL);
    await transport.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text: `${text}\n\n${link ?? ""}`,
    });
    return true;
  } catch (e) {
    logError("mail", e);
    return false;
  }
}
