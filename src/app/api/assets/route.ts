import { ASSETS } from "@/config/assets";
import { handleApiError, jsonOk } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { getAssetsList } from "@/lib/services/market";

export const dynamic = "force-dynamic";

/** قائمة الأصول المدعومة مع آخر بيانات السوق وآخر درجة تحليل */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const withData = url.searchParams.get("data") !== "false";
    const catalog = ASSETS.map((a) => ({ symbol: a.symbol, display: a.display, name: a.name, nameAr: a.nameAr, kind: a.kind }));
    if (!withData) return jsonOk({ catalog });
    const viewer = await getViewer();
    const symbols = ASSETS.filter((a) => a.kind === "CRYPTO" || a.kind === "STABLECOIN").map((a) => a.symbol);
    const assets = await getAssetsList(viewer, symbols);
    return jsonOk({ catalog, assets });
  } catch (e) {
    return handleApiError(e, "api.assets");
  }
}
