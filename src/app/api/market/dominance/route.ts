import { handleApiError, jsonOk } from "@/lib/api";
import { getMarketDataProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await getMarketDataProvider().getDominanceData());
  } catch (e) {
    return handleApiError(e, "api.market.dominance");
  }
}
