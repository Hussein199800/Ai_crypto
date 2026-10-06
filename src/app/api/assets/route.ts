import { z } from "zod";
import { ASSETS } from "@/config/assets";
import { handleApiError, jsonOk } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { getAssetsList } from "@/lib/services/market";
import { symbolSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const symbolsSchema = z
  .string()
  .max(600)
  .transform((s) => s.split(",").filter(Boolean))
  .pipe(z.array(symbolSchema).max(50, "عدد الرموز كبير جدًا"));

/**
 * قائمة الأصول المدعومة مع آخر بيانات السوق وآخر درجة تحليل.
 * ?symbols=BTC,ETH لجلب أصول محددة، ?data=false للكتالوج فقط.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const catalog = ASSETS.map((a) => ({ symbol: a.symbol, display: a.display, name: a.name, nameAr: a.nameAr, kind: a.kind }));
    if (url.searchParams.get("data") === "false") return jsonOk({ catalog });
    const viewer = await getViewer();
    const raw = url.searchParams.get("symbols");
    const symbols = raw ? symbolsSchema.parse(raw) : ASSETS.filter((a) => a.kind === "CRYPTO" || a.kind === "STABLECOIN").map((a) => a.symbol);
    const assets = symbols.length ? await getAssetsList(viewer, symbols) : [];
    return jsonOk({ catalog, assets });
  } catch (e) {
    return handleApiError(e, "api.assets");
  }
}
