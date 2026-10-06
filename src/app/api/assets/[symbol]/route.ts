import { handleApiError, jsonOk } from "@/lib/api";
import { getMarketDataProvider } from "@/lib/providers";
import { symbolSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const symbol = symbolSchema.parse((await params).symbol);
    const overview = await getMarketDataProvider().getAssetOverview(symbol);
    return jsonOk(overview);
  } catch (e) {
    return handleApiError(e, "api.asset");
  }
}
