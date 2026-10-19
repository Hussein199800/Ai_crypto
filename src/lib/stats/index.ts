/**
 * أدوات إحصائية للنماذج الاحتمالية. كل النتائج نطاقات تاريخية/احتمالية وليست توقعات مؤكدة.
 */

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  return out;
}

export function meanOf(v: number[]): number {
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}

export function varianceOf(v: number[], sample = true): number {
  if (v.length < 2) return 0;
  const m = meanOf(v);
  return v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - (sample ? 1 : 0));
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** مولد عشوائي حتمي (للتكرار نفس النتيجة لنفس البيانات) */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalSampler(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

// ───────────── مونت كارلو (حركة براونية هندسية) ─────────────

export interface MonteCarloResult {
  horizon: number;
  paths: number;
  drift: number;
  volatility: number;
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  probAbove: number;
  /** مسار الوسيط والنطاقات لكل يوم (للرسم) */
  bands: { day: number; p5: number; p50: number; p95: number }[];
}

export function monteCarloGBM(closes: number[], horizon = 30, paths = 2000, seed = 42): MonteCarloResult | null {
  const r = logReturns(closes);
  if (r.length < 30) return null;
  const mu = meanOf(r);
  const sigma = Math.sqrt(varianceOf(r));
  const s0 = closes[closes.length - 1];
  const rand = normalSampler(seededRandom(seed));
  const perDay: number[][] = Array.from({ length: horizon }, () => []);
  for (let p = 0; p < paths; p++) {
    let s = s0;
    for (let d = 0; d < horizon; d++) {
      // dS/S = (μ − σ²/2)dt + σ dW  (dt = يوم واحد، μ وσ من العوائد اللوغاريتمية مباشرة)
      s *= Math.exp(mu + sigma * rand());
      perDay[d].push(s);
    }
  }
  const finals = [...perDay[horizon - 1]].sort((a, b) => a - b);
  const bands = perDay.map((vals, d) => {
    const sorted = [...vals].sort((a, b) => a - b);
    return { day: d + 1, p5: quantile(sorted, 0.05), p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95) };
  });
  return {
    horizon,
    paths,
    drift: mu,
    volatility: sigma,
    percentiles: {
      p5: quantile(finals, 0.05),
      p25: quantile(finals, 0.25),
      p50: quantile(finals, 0.5),
      p75: quantile(finals, 0.75),
      p95: quantile(finals, 0.95),
    },
    probAbove: finals.filter((v) => v > s0).length / finals.length,
    bands,
  };
}

// ───────────── GARCH(1,1) ─────────────

export interface GarchResult {
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  /** التقلب اليومي الحالي المقدّر */
  currentVol: number;
  /** التقلب طويل المدى */
  longRunVol: number;
  /** توقع التقلب التراكمي (انحراف معياري للعائد) لعدد أيام */
  forecast: { days: number; vol: number }[];
  logLikelihood: number;
}

/** تقدير GARCH(1,1) بالبحث الشبكي مع استهداف التباين (variance targeting) */
export function garch11(returns: number[]): GarchResult | null {
  if (returns.length < 100) return null;
  const m = meanOf(returns);
  const e = returns.map((x) => x - m);
  const uncond = varianceOf(e, false);
  let best: { a: number; b: number; ll: number; lastVar: number } | null = null;
  for (let a = 0.02; a <= 0.3001; a += 0.01) {
    for (let b = 0.5; b <= 0.9801; b += 0.01) {
      if (a + b >= 0.999) continue;
      const omega = uncond * (1 - a - b);
      let v = uncond;
      let ll = 0;
      for (let t = 0; t < e.length; t++) {
        if (t > 0) v = omega + a * e[t - 1] ** 2 + b * v;
        ll += -0.5 * (Math.log(2 * Math.PI) + Math.log(v) + e[t] ** 2 / v);
      }
      if (!best || ll > best.ll) best = { a, b, ll, lastVar: omega + a * e[e.length - 1] ** 2 + b * v };
    }
  }
  if (!best) return null;
  const omega = uncond * (1 - best.a - best.b);
  const pers = best.a + best.b;
  const forecast = [1, 7, 30].map((days) => {
    // مجموع التباينات المتوقعة للأيام القادمة
    let total = 0;
    for (let h = 1; h <= days; h++) total += uncond + pers ** (h - 1) * (best!.lastVar - uncond);
    return { days, vol: Math.sqrt(total) };
  });
  return {
    omega,
    alpha: best.a,
    beta: best.b,
    persistence: pers,
    currentVol: Math.sqrt(best.lastVar),
    longRunVol: Math.sqrt(uncond),
    forecast,
    logLikelihood: best.ll,
  };
}

// ───────────── نموذج ماركوف المخفي (HMM) غاوسي ─────────────

export interface HmmResult {
  states: { mean: number; std: number }[];
  transition: number[][];
  /** احتمال كل حالة عند آخر نقطة */
  current: number[];
  /** الحالة الأرجح لكل نقطة */
  path: number[];
  logLikelihood: number;
}

const gauss = (x: number, m: number, s: number) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

/**
 * HMM بحالات غاوسية عبر خوارزمية Baum-Welch (مع تقييس لتجنب الانهيار العددي).
 * تُرتّب الحالات تصاعديًا حسب المتوسط.
 */
export function gaussianHmm(obs: number[], k = 3, iterations = 40): HmmResult | null {
  const n = obs.length;
  if (n < 60) return null;
  const sorted = [...obs].sort((a, b) => a - b);
  let means = Array.from({ length: k }, (_, i) => quantile(sorted, (i + 0.5) / k));
  const s0 = Math.sqrt(varianceOf(obs)) || 1e-6;
  let stds = Array.from({ length: k }, () => s0);
  let pi = Array.from({ length: k }, () => 1 / k);
  let A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 0.9 : 0.1 / (k - 1))));
  let ll = -Infinity;
  let gamma: number[][] = [];

  for (let it = 0; it < iterations; it++) {
    const B = obs.map((x) => means.map((m, j) => Math.max(gauss(x, m, stds[j]), 1e-300)));
    const alpha: number[][] = [];
    const scale: number[] = [];
    for (let t = 0; t < n; t++) {
      const row = means.map((_, j) => (t === 0 ? pi[j] : alpha[t - 1].reduce((s, a, i) => s + a * A[i][j], 0)) * B[t][j]);
      const c = row.reduce((s, v) => s + v, 0) || 1e-300;
      scale.push(c);
      alpha.push(row.map((v) => v / c));
    }
    const beta: number[][] = new Array(n);
    beta[n - 1] = means.map(() => 1);
    for (let t = n - 2; t >= 0; t--) {
      beta[t] = means.map((_, i) => means.reduce((s, _m, j) => s + A[i][j] * B[t + 1][j] * beta[t + 1][j], 0) / scale[t + 1]);
    }
    gamma = alpha.map((a, t) => {
      const g = a.map((v, j) => v * beta[t][j]);
      const z = g.reduce((s, v) => s + v, 0) || 1;
      return g.map((v) => v / z);
    });
    const xiSum = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let t = 0; t < n - 1; t++) {
      let z = 0;
      const xi = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => {
        const v = alpha[t][i] * A[i][j] * B[t + 1][j] * beta[t + 1][j];
        z += v;
        return v;
      }));
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) xiSum[i][j] += xi[i][j] / (z || 1);
    }
    pi = gamma[0];
    A = xiSum.map((row) => {
      const z = row.reduce((s, v) => s + v, 0) || 1;
      return row.map((v) => v / z);
    });
    means = means.map((_, j) => {
      const w = gamma.reduce((s, g) => s + g[j], 0) || 1;
      return gamma.reduce((s, g, t) => s + g[j] * obs[t], 0) / w;
    });
    stds = stds.map((_, j) => {
      const w = gamma.reduce((s, g) => s + g[j], 0) || 1;
      const v = gamma.reduce((s, g, t) => s + g[j] * (obs[t] - means[j]) ** 2, 0) / w;
      return Math.max(Math.sqrt(v), s0 * 0.05);
    });
    const newLl = scale.reduce((s, c) => s + Math.log(c), 0);
    if (Math.abs(newLl - ll) < 1e-6) {
      ll = newLl;
      break;
    }
    ll = newLl;
  }
  // ترتيب الحالات حسب المتوسط
  const order = means.map((m, i) => ({ m, i })).sort((a, b) => a.m - b.m).map((x) => x.i);
  const remap = (arr: number[]) => order.map((i) => arr[i]);
  return {
    states: order.map((i) => ({ mean: means[i], std: stds[i] })),
    transition: order.map((i) => order.map((j) => A[i][j])),
    current: remap(gamma[n - 1]),
    path: gamma.map((g) => order.indexOf(g.indexOf(Math.max(...g)))),
    logLikelihood: ll,
  };
}

// ───────────── تحليل فورييه (الدورات) ─────────────

export interface CycleResult {
  period: number;
  amplitude: number;
  /** القوة النسبية من مجموع الطيف */
  power: number;
  /** موقع الدورة الحالي: صاعدة أم هابطة */
  phase: "RISING" | "FALLING";
  /** عدد الشموع المتبقية تقريبًا حتى القمة/القاع التالي */
  barsToTurn: number;
}

/** أقوى الدورات في السلسلة بعد إزالة الاتجاه الخطي (DFT مباشر) */
export function dominantCycles(values: number[], top = 3, minPeriod = 5): CycleResult[] {
  const n = values.length;
  if (n < 32) return [];
  // إزالة الاتجاه الخطي
  const mx = (n - 1) / 2;
  const my = meanOf(values);
  let sxy = 0;
  let sxx = 0;
  values.forEach((v, i) => {
    sxy += (i - mx) * (v - my);
    sxx += (i - mx) ** 2;
  });
  const slope = sxy / sxx;
  const detr = values.map((v, i) => v - (my + slope * (i - mx)));
  const spectrum: { k: number; re: number; im: number; p: number }[] = [];
  for (let k = 1; k <= Math.floor(n / minPeriod); k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t++) {
      const ang = (2 * Math.PI * k * t) / n;
      re += detr[t] * Math.cos(ang);
      im -= detr[t] * Math.sin(ang);
    }
    spectrum.push({ k, re, im, p: re * re + im * im });
  }
  const totalP = spectrum.reduce((s, x) => s + x.p, 0) || 1;
  return [...spectrum]
    .sort((a, b) => b.p - a.p)
    .slice(0, top)
    .map(({ k, re, im, p }) => {
      const period = n / k;
      const phi = Math.atan2(im, re);
      // قيمة الدورة عند t: cos(2πk t/n + φ)، ومشتقتها تحدد الصعود/الهبوط عند آخر نقطة
      const angNow = (2 * Math.PI * k * (n - 1)) / n + phi;
      const deriv = -Math.sin(angNow);
      const norm = ((angNow % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      // القمة عند 0 (أو 2π) والقاع عند π
      const toTurn = deriv > 0 ? (2 * Math.PI - norm) : (Math.PI - norm + (norm > Math.PI ? 2 * Math.PI : 0));
      return {
        period,
        amplitude: (2 * Math.sqrt(p)) / n,
        power: p / totalP,
        phase: deriv > 0 ? "RISING" : "FALLING",
        barsToTurn: Math.max(0, Math.round((toTurn / (2 * Math.PI)) * period)),
      };
    });
}

// ───────────── AR(p) / ARIMA(p,1,0) ─────────────

export interface ArimaResult {
  p: number;
  coefficients: number[];
  intercept: number;
  residualStd: number;
  /** توقع السعر مع نطاق ثقة 80% و95% */
  forecast: { step: number; mean: number; lo80: number; hi80: number; lo95: number; hi95: number }[];
}

/** حل نظام خطي بطريقة غاوس (للمربعات الصغرى) */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * ARIMA(p,1,0): نموذج انحدار ذاتي على العوائد اللوغاريتمية (الفرق الأول للوغاريتم السعر)
 * مقدّر بالمربعات الصغرى، ثم يُعاد بناء مسار السعر المتوقع مع نطاقات الثقة.
 */
export function arima(closes: number[], p = 5, steps = 7): ArimaResult | null {
  const r = logReturns(closes);
  if (r.length < p + 50) return null;
  const rows: number[][] = [];
  const y: number[] = [];
  for (let t = p; t < r.length; t++) {
    rows.push([1, ...Array.from({ length: p }, (_, j) => r[t - 1 - j])]);
    y.push(r[t]);
  }
  const k = p + 1;
  const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => rows.reduce((s, row) => s + row[i] * row[j], 0)));
  const Xty = Array.from({ length: k }, (_, i) => rows.reduce((s, row, t) => s + row[i] * y[t], 0));
  const beta = solve(XtX, Xty);
  if (!beta) return null;
  const resid = rows.map((row, t) => y[t] - row.reduce((s, v, i) => s + v * beta[i], 0));
  const sd = Math.sqrt(varianceOf(resid));
  const hist = [...r];
  let logP = Math.log(closes[closes.length - 1]);
  const forecast: ArimaResult["forecast"] = [];
  // معاملات تمثيل MA(∞) لحساب تباين خطأ التوقع التراكمي
  const psi: number[] = [1];
  for (let h = 1; h < steps; h++) {
    let v = 0;
    for (let j = 1; j <= Math.min(h, p); j++) v += beta[j] * psi[h - j];
    psi.push(v);
  }
  let cumPsi = 0;
  let cumVar = 0;
  for (let h = 1; h <= steps; h++) {
    const next = beta[0] + Array.from({ length: p }, (_, j) => beta[j + 1] * hist[hist.length - 1 - j]).reduce((s, v) => s + v, 0);
    hist.push(next);
    logP += next;
    cumPsi += psi[h - 1];
    cumVar += cumPsi * cumPsi;
    const se = sd * Math.sqrt(cumVar);
    forecast.push({
      step: h,
      mean: Math.exp(logP),
      lo80: Math.exp(logP - 1.2816 * se),
      hi80: Math.exp(logP + 1.2816 * se),
      lo95: Math.exp(logP - 1.96 * se),
      hi95: Math.exp(logP + 1.96 * se),
    });
  }
  return { p, coefficients: beta.slice(1), intercept: beta[0], residualStd: sd, forecast };
}
