import type { Viewer } from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { getAssetsList } from "./market";

const MAX_ITEMS = 50;

export async function getWatchlist(viewer: Viewer) {
  const rows = await prisma.watchlist.findMany({ where: { userId: viewer.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const symbols = rows.map((r) => r.symbol);
  const assets = symbols.length ? await getAssetsList(viewer, symbols).catch(() => []) : [];
  return rows.map((r) => ({ symbol: r.symbol, position: r.position, asset: assets.find((a) => a.symbol === r.symbol) ?? null }));
}

export async function addToWatchlist(viewer: Viewer, symbol: string) {
  const count = await prisma.watchlist.count({ where: { userId: viewer.id } });
  if (count >= MAX_ITEMS) throw new HttpError(400, `الحد الأقصى للمفضلة ${MAX_ITEMS} عنصرًا`);
  return prisma.watchlist.upsert({
    where: { userId_symbol: { userId: viewer.id, symbol } },
    update: {},
    create: { userId: viewer.id, symbol, position: count },
  });
}

export async function removeFromWatchlist(viewer: Viewer, symbol: string) {
  // الحذف مقيد بالمستخدم الحالي — لا يمكن حذف عناصر مستخدم آخر
  const res = await prisma.watchlist.deleteMany({ where: { userId: viewer.id, symbol } });
  return res.count > 0;
}

export async function reorderWatchlist(viewer: Viewer, symbols: string[]) {
  await prisma.$transaction(
    symbols.map((symbol, position) => prisma.watchlist.updateMany({ where: { userId: viewer.id, symbol }, data: { position } })),
  );
}
