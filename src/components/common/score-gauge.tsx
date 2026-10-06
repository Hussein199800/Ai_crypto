import { cn } from "@/lib/utils";

/** مقياس نصف دائري للدرجة 0..100 (أحمر ← أصفر ← أخضر) مع نص يوضح القيمة */
export function ScoreGauge({ value, label, size = 180, className }: { value: number; label?: string; size?: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 70;
  const cx = 90;
  const cy = 90;
  const angle = Math.PI * (1 - v / 100);
  const nx = cx + (r - 14) * Math.cos(angle);
  const ny = cy - (r - 14) * Math.sin(angle);
  const arc = (from: number, to: number) => {
    const a1 = Math.PI * (1 - from / 100);
    const a2 = Math.PI * (1 - to / 100);
    return `M ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a2)} ${cy - r * Math.sin(a2)}`;
  };
  const segments: [number, number, string][] = [
    [0, 29, "#EF4444"],
    [30, 44, "#F97316"],
    [45, 64, "#F59E0B"],
    [65, 79, "#84CC16"],
    [80, 100, "#22C55E"],
  ];
  return (
    <figure className={cn("flex flex-col items-center", className)} style={{ width: size }}>
      <svg viewBox="0 0 180 105" width={size} height={size * 0.58} role="img" aria-label={`${label ?? "الدرجة"}: ${Math.round(v)} من 100`}>
        {segments.map(([a, b, color]) => (
          <path key={a} d={arc(a + 0.8, b + 0.2)} stroke={color} strokeWidth="12" fill="none" strokeLinecap="butt" opacity={0.9} />
        ))}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="currentColor" />
      </svg>
      <figcaption className="-mt-1 text-center">
        <span className="num text-3xl font-bold">{Math.round(v)}</span>
        <span className="text-sm text-muted-foreground"> / 100</span>
        {label && <div className="text-xs text-muted-foreground">{label}</div>}
      </figcaption>
    </figure>
  );
}

/** حلقة نسبة الثقة */
export function ConfidenceRing({ value, size = 96, label = "الثقة" }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 40;
  const c = 2 * Math.PI * r;
  const color = v >= 65 ? "#22C55E" : v >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <figure className="flex flex-col items-center gap-1" style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: ${Math.round(v)}%`}>
        <circle cx="50" cy="50" r={r} stroke="currentColor" strokeOpacity="0.15" strokeWidth="10" fill="none" />
        <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="10" fill="none" strokeDasharray={`${(v / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 50 50)" />
        <text x="50" y="55" textAnchor="middle" className="num" fontSize="20" fontWeight="700" fill="currentColor">
          {Math.round(v)}%
        </text>
      </svg>
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
