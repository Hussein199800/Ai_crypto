import { assertSameOrigin, handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { createAlert, listAlerts } from "@/lib/services/alerts";
import { alertCreateSchema, firstError } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viewer = await getViewer();
    if (!viewer) return jsonError(401, "يجب تسجيل الدخول");
    return jsonOk(await listAlerts(viewer));
  } catch (e) {
    return handleApiError(e, "api.alerts.list");
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    if (!viewer) return jsonError(401, "يجب تسجيل الدخول");
    const parsed = alertCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error));
    return jsonOk(await createAlert(viewer, parsed.data), { status: 201 });
  } catch (e) {
    return handleApiError(e, "api.alerts.create");
  }
}
