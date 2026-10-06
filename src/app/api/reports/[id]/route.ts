import { handleApiError, jsonOk } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { getReportById } from "@/lib/services/reports";
import { reportIdSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = reportIdSchema.parse((await params).id);
    return jsonOk(await getReportById(id, await getViewer()));
  } catch (e) {
    return handleApiError(e, "api.reports.get");
  }
}
