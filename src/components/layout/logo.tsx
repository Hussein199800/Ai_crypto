import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold" aria-label="CryptoScope AI — الرئيسية">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-positive/50 bg-positive/10 shadow-glow">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-positive" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
          <path d="M7.5 13 10 10.5l1.8 1.8L14.5 9" />
        </svg>
      </span>
      <span className="text-base tracking-tight" dir="ltr">
        CryptoScope <span className="text-positive">AI</span>
      </span>
    </Link>
  );
}
