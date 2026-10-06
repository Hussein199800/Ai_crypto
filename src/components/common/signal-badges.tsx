import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Gauge, Info, MinusCircle, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RECOMMENDATION_LABELS, RECOMMENDATION_TONE, RISK_LABELS, HORIZON_LABELS, DIRECTION_LABELS } from "@/lib/formatters/labels";
import type { Horizon, Recommendation, RiskLevel, SignalDirection } from "@/types/analysis";

const REC_ICONS = {
  positive: ArrowUpCircle,
  negative: ArrowDownCircle,
  warning: MinusCircle,
  info: Info,
  neutral: MinusCircle,
} as const;

export function RecommendationBadge({ value, className }: { value: Recommendation; className?: string }) {
  const tone = RECOMMENDATION_TONE[value];
  const Icon = REC_ICONS[tone];
  return (
    <Badge variant={tone} className={className}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {RECOMMENDATION_LABELS[value]}
    </Badge>
  );
}

export function RiskBadge({ value, className }: { value: RiskLevel; className?: string }) {
  const map = { LOW: ["positive", ShieldCheck], MEDIUM: ["warning", ShieldQuestion], HIGH: ["negative", ShieldAlert] } as const;
  const [variant, Icon] = map[value];
  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      مخاطرة {RISK_LABELS[value]}
    </Badge>
  );
}

export function HorizonBadge({ value }: { value: Horizon }) {
  return (
    <Badge variant="neutral">
      <Gauge className="h-3.5 w-3.5" aria-hidden />
      {HORIZON_LABELS[value]} المدى
    </Badge>
  );
}

export function DirectionBadge({ value }: { value: SignalDirection }) {
  const variant = value === "positive" ? "positive" : value === "negative" ? "negative" : "neutral";
  const Icon = value === "positive" ? ArrowUpCircle : value === "negative" ? ArrowDownCircle : MinusCircle;
  return (
    <Badge variant={variant}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {DIRECTION_LABELS[value]}
    </Badge>
  );
}

export function MockBadge() {
  return (
    <Badge variant="warning">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      بيانات تجريبية
    </Badge>
  );
}
