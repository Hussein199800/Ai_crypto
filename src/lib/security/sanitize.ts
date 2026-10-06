/** إزالة أي وسوم HTML وأحرف تحكم من نص قادم من المستخدم (طبقة دفاع إضافية فوق ترميز React) */
export function sanitizeText(input: string, maxLength = 500): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}
