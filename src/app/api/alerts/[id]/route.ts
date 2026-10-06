import { assertSameOrigin, handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { deleteAlert } from "@/lib/services/alerts";
import { idSchema } from "@/lib/validators";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    if (!viewer) return jsonError(401, "يجب تسجيل الدخول");
    const id = idSchema.parse((await params).id);
    await deleteAlert(viewer, id);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e, "api.alerts.delete");
  }
}
