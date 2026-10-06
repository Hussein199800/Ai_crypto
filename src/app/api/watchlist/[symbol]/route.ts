import { assertSameOrigin, handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { removeFromWatchlist } from "@/lib/services/watchlist";
import { symbolSchema } from "@/lib/validators";

export async function DELETE(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    if (!viewer) return jsonError(401, "يجب تسجيل الدخول");
    const symbol = symbolSchema.parse((await params).symbol);
    const removed = await removeFromWatchlist(viewer, symbol);
    if (!removed) return jsonError(404, "العنصر غير موجود في المفضلة");
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e, "api.watchlist.delete");
  }
}
