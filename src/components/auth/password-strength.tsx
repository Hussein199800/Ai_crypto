import { Check, X } from "lucide-react";

const RULES: [string, (p: string) => boolean][] = [
  ["10 أحرف على الأقل", (p) => p.length >= 10],
  ["حرف إنجليزي صغير", (p) => /[a-z]/.test(p)],
  ["حرف إنجليزي كبير", (p) => /[A-Z]/.test(p)],
  ["رقم", (p) => /\d/.test(p)],
  ["رمز خاص مثل ! أو @", (p) => /[^A-Za-z0-9]/.test(p)],
];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="grid grid-cols-2 gap-1 text-xs" aria-label="متطلبات كلمة المرور">
      {RULES.map(([label, test]) => {
        const ok = test(password);
        return (
          <li key={label} className={ok ? "text-positive" : "text-muted-foreground"}>
            {ok ? <Check className="inline h-3 w-3" aria-hidden /> : <X className="inline h-3 w-3" aria-hidden />} {label}
          </li>
        );
      })}
    </ul>
  );
}
