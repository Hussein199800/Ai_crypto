import type { Metadata } from "next";
import { BookOpen, Cpu, Database, FileText, Gauge, Lock, ShieldAlert, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CATEGORY_LABELS, CATEGORY_WEIGHTS, SIGNAL_BANDS } from "@/config/scoring";
import { DISCLAIMER } from "@/lib/formatters/labels";
import type { ScoreCategory } from "@/types/analysis";

export const metadata: Metadata = { title: "حول المنصة" };

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-positive/40 bg-positive/10 text-positive">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
      </Card>
    </section>
  );
}

const INDICATORS = [
  ["المتوسطات المتحركة الأسية EMA 20/50/100/200", "تحديد الاتجاه وقوته والتقاطع الذهبي وتقاطع الموت."],
  ["المتوسطات البسيطة SMA 20/50", "مراجع إضافية لموقع السعر."],
  ["مؤشر القوة النسبية RSI 14", "قياس الزخم ومناطق التشبع (تحذير وليس قرارًا منفردًا)."],
  ["MACD وخط الإشارة والهيستوجرام", "تسارع أو تباطؤ الزخم."],
  ["نطاقات بولينجر Bollinger Bands", "موقع السعر نسبة إلى تقلبه المعتاد."],
  ["متوسط المدى الحقيقي ATR", "قياس التقلب ومسافة الإبطال."],
  ["مؤشر متوسط الاتجاه ADX مع +DI/-DI", "قوة الاتجاه."],
  ["Stochastic RSI", "توقيت قصير المدى للزخم."],
  ["حجم التوازن OBV ومتوسط الحجم", "تأكيد الحركة بالسيولة وكشف الحركات غير المدعومة."],
  ["الدعم والمقاومة وفيبوناتشي", "مستويات مشتقة من القمم والقيعان الحقيقية فقط."],
  ["VWAP", "على الأطر اللحظية فقط (مُرسى يوميًا)."],
  ["هيمنة البيتكوين BTC.D وهيمنة تيثر USDT.D", "تُحسب: القيمة السوقية للأصل ÷ إجمالي السوق × 100، وتُقرأ مع اتجاه السوق."],
  ["TOTAL / TOTAL2 / TOTAL3 وETH/BTC", "بيئة السوق وتدفق السيولة نحو العملات البديلة."],
  ["مؤشر الخوف والطمع", "معنويات السوق (alternative.me)."],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">حول المنصة</h1>
        <p className="text-muted-foreground">CryptoScope AI — منصة تحليل آلي متعدد المؤشرات للعملات الرقمية.</p>
      </div>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="أقسام الصفحة">
        {[
          ["intro", "تعريف"],
          ["how", "كيف يعمل التحليل"],
          ["indicators", "المؤشرات"],
          ["limits", "حدود التحليل"],
          ["risk", "تنبيه المخاطر"],
          ["privacy", "الخصوصية"],
          ["terms", "شروط الاستخدام"],
          ["sources", "مصادر البيانات"],
        ].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="rounded-md border px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            {l}
          </a>
        ))}
      </nav>

      <Section id="intro" title="تعريف بالمنصة" icon={BookOpen}>
        <p>
          تجمع المنصة بيانات الأسعار والشموع وبيانات السوق العامة من مزودين معتمدين، ثم تحسب مجموعة واسعة من المؤشرات الفنية على خمسة أطر زمنية، وتربطها بحالة السوق العام (BTC.D وUSDT.D وTOTAL ومعنويات السوق)، لتنتج تقريرًا عربيًا مفصلًا يتضمن تقييمًا احتماليًا ومستوى ثقة ونقاط القوة والضعف والمخاطر والسيناريوهات.
        </p>
        <p className="font-medium">المنصة لا تقدم استشارة مالية مرخّصة، وكل النتائج إشارات تحليلية آلية.</p>
      </Section>

      <Section id="how" title="كيف يعمل نظام التحليل؟" icon={Cpu}>
        <ol className="list-inside list-decimal space-y-1">
          <li>جلب آخر بيانات السوق والتحقق من اكتمالها وحداثتها.</li>
          <li>حساب المؤشرات الفنية على أطر 15 دقيقة، ساعة، 4 ساعات، يومي، وأسبوعي (على الشموع المكتملة فقط).</li>
          <li>تحويل كل مؤشر إلى إشارة من -1 إلى +1 مع شرح عربي، ثم تجميعها في فئات.</li>
          <li>ترجيح الأطر الزمنية بحسب الأفق المختار (قصير / متوسط / طويل).</li>
          <li>ربط النتيجة بالسوق العام: لا يُعتمد على مؤشر واحد أبدًا.</li>
          <li>حساب الدرجة الخام، ثم تعديلها نحو الحياد بحسب جودة البيانات، ثم حساب مستوى الثقة.</li>
          <li>تطبيق حواجز أمان: التضارب أو نقص البيانات أو ضعف الثقة يؤدي إلى «محايد / انتظار».</li>
        </ol>
        <h3 className="pt-2 font-semibold">أوزان الفئات الافتراضية (قابلة للتعديل في config/scoring.ts)</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(CATEGORY_WEIGHTS) as ScoreCategory[]).map((c) => (
            <div key={c} className="flex justify-between rounded-md border px-3 py-2">
              <span>{CATEGORY_LABELS[c]}</span>
              <span className="num">{Math.round(CATEGORY_WEIGHTS[c] * 100)}%</span>
            </div>
          ))}
        </div>
        <h3 className="pt-2 font-semibold">نطاقات الإشارة</h3>
        <ul className="space-y-1">
          <li><span className="num">{SIGNAL_BANDS.strongPositive}–100</span>: إيجابي قوي (مع عرض المخاطر دائمًا) — «شراء محتمل» فقط إذا كانت الثقة كافية.</li>
          <li><span className="num">{SIGNAL_BANDS.cautiousPositive}–{SIGNAL_BANDS.strongPositive - 1}</span>: إيجابي بحذر / شراء تدريجي محتمل.</li>
          <li><span className="num">{SIGNAL_BANDS.neutral}–{SIGNAL_BANDS.cautiousPositive - 1}</span>: محايد / انتظار.</li>
          <li><span className="num">{SIGNAL_BANDS.cautiousNegative}–{SIGNAL_BANDS.neutral - 1}</span>: سلبي بحذر / تقليل المخاطرة.</li>
          <li><span className="num">0–{SIGNAL_BANDS.cautiousNegative - 1}</span>: سلبي قوي / عدم شراء — و«بيع محتمل» فقط مع اتجاه هابط قوي مؤكد وثقة كافية.</li>
        </ul>
        <p>المؤشرات السوقية (BTC.D، USDT.D، TOTAL، ETH/BTC) والعملات المستقرة لا تُصدر لها توصيات شراء أو بيع، بل قراءة سوقية.</p>
      </Section>

      <Section id="indicators" title="ما المؤشرات المستخدمة؟" icon={Gauge}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INDICATORS.map(([n, d]) => (
            <li key={n} className="rounded-md border p-3">
              <div className="font-medium">{n}</div>
              <div className="text-xs text-muted-foreground">{d}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="limits" title="ما حدود التحليل؟" icon={TriangleAlert}>
        <ul className="list-inside list-disc space-y-1">
          <li>التحليل الفني يعتمد على البيانات التاريخية ولا يتنبأ بالأحداث المفاجئة (أخبار، قرارات تنظيمية، اختراقات).</li>
          <li>البيانات المجانية قد تتأخر أو تكون محدودة؛ تُعرض حداثة البيانات ومصدرها دائمًا، وتُخفَّض الثقة عند النقص.</li>
          <li>اختلاف تعريف «إجمالي السوق» بين المزودين يؤدي إلى اختلاف قيم BTC.D وUSDT.D.</li>
          <li>لا يُعطي النظام شراء لمجرد أن RSI منخفض، ولا بيعًا لمجرد أنه مرتفع.</li>
          <li>المستويات والأهداف سيناريوهات مشروطة وليست ضمانًا، ولا تُخترع أرقام عند نقص البيانات.</li>
        </ul>
      </Section>

      <Section id="risk" title="تنبيه المخاطر" icon={ShieldAlert}>
        <p>{DISCLAIMER}</p>
      </Section>

      <Section id="privacy" title="سياسة الخصوصية" icon={Lock}>
        <ul className="list-inside list-disc space-y-1">
          <li>نخزّن فقط ما يلزم لتشغيل الحساب: الاسم والبريد وتجزئة كلمة المرور (bcrypt) — لا تُخزَّن كلمات المرور مكشوفة.</li>
          <li>المفضلة والتقارير الخاصة والتنبيهات مرتبطة بحسابك ولا يراها غيرك.</li>
          <li>مفضلة الزوار تُحفظ في متصفحهم فقط (Local Storage).</li>
          <li>لا نبيع البيانات ولا نشاركها مع أطراف ثالثة، ولا تُرسل مفاتيح مزودي البيانات إلى المتصفح.</li>
          <li>تُسجَّل الأخطاء التقنية دون أسرار أو بيانات حساسة.</li>
        </ul>
      </Section>

      <Section id="terms" title="شروط الاستخدام" icon={FileText}>
        <ul className="list-inside list-disc space-y-1">
          <li>المنصة للأغراض التعليمية والمعلوماتية فقط، ولا تشكل عرضًا أو توصية لشراء أو بيع أي أصل.</li>
          <li>أنت وحدك المسؤول عن قراراتك الاستثمارية ونتائجها.</li>
          <li>يُمنع إساءة استخدام الخدمة أو محاولة تجاوز حدود الطلبات أو الوصول غير المصرح به.</li>
          <li>قد تتغير المؤشرات والأوزان والمصادر لتحسين الخدمة.</li>
        </ul>
      </Section>

      <Section id="sources" title="مصادر البيانات" icon={Database}>
        <ul className="list-inside list-disc space-y-1">
          <li>CoinGecko API — الأسعار والقيم السوقية وبيانات السوق العامة.</li>
          <li>CoinMarketCap API — بديل احتياطي عند توفر مفتاح.</li>
          <li>Binance (Market Data العامة) — بيانات الشموع OHLCV وفارق السعر.</li>
          <li>alternative.me — مؤشر الخوف والطمع.</li>
          <li>CryptoPanic (اختياري) — عناوين الأخبار.</li>
          <li>TradingView — فقط عبر تكامل رسمي مُعدّ في ملف البيئة؛ لا نستخدم أي استخراج يخالف شروط الخدمة.</li>
        </ul>
        <p>يُعرض مصدر البيانات ووقت آخر تحديث مع كل قسم، وتوسم البيانات القديمة أو التجريبية بوضوح.</p>
      </Section>
    </div>
  );
}
