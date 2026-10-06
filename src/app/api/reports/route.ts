import { handleApiError, jsonOk, searchParamsObject } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { listReports } from "@/lib/services/reports";
import { reportsQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const q = reportsQuerySchema.parse(searchParamsObject(req.url));
    return jsonOk(await listReports(q, await getViewer()));
  } catch (e) {
    return handleApiError(e, "api.reports.list");
  }
}
