import { handleApiError, jsonOk, searchParamsObject } from "@/lib/api";
import { getChartData } from "@/lib/services/charts";
import { chartQuerySchema, symbolSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const symbol = symbolSchema.parse((await params).symbol);
    const q = chartQuerySchema.parse(searchParamsObject(req.url));
    return jsonOk(await getChartData(symbol, q.timeframe, q.limit));
  } catch (e) {
    return handleApiError(e, "api.charts");
  }
}
