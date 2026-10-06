import { handleApiError, jsonOk, searchParamsObject } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { getLatestReport } from "@/lib/services/reports";
import { horizonSchema, symbolSchema } from "@/lib/validators";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ symbol: symbolSchema, horizon: horizonSchema.optional() });

export async function GET(req: Request) {
  try {
    const q = schema.parse(searchParamsObject(req.url));
    return jsonOk({ report: await getLatestReport(q.symbol, await getViewer(), q.horizon) });
  } catch (e) {
    return handleApiError(e, "api.reports.latest");
  }
}
