import { assertSameOrigin, handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { addToWatchlist, getWatchlist, reorderWatchlist } from "@/lib/services/watchlist";
import { firstError, watchlistAddSchema, watchlistReorderSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const UNAUTH = "يجب تسجيل الدخول لحفظ المفضلة في حسابك";

export async function GET() {
  try {
    const viewer = await getViewer();
    if (!viewer) return jsonError(401, UNAUTH);
    return jsonOk({ items: await getWatchlist(viewer) });
  } catch (e) {
    return handleApiError(e, "api.watchlist.get");
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    if (!viewer) return jsonError(401, UNAUTH);
    const parsed = watchlistAddSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error));
    await addToWatchlist(viewer, parsed.data.symbol);
    return jsonOk({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e, "api.watchlist.add");
  }
}

/** إعادة ترتيب المفضلة */
export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    if (!viewer) return jsonError(401, UNAUTH);
    const parsed = watchlistReorderSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error));
    await reorderWatchlist(viewer, parsed.data.symbols);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e, "api.watchlist.reorder");
  }
}
