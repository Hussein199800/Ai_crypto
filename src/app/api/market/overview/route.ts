import { handleApiError, jsonOk } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/services/market";

export const dynamic = "force-dynamic";

/** بيانات لوحة التحكم مجمعة في طلب واحد */
export async function GET() {
  try {
    return jsonOk(await getDashboardData(await getViewer()));
  } catch (e) {
    return handleApiError(e, "api.market.overview");
  }
}
