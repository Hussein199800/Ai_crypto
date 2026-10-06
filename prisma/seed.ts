/**
 * بذر قاعدة البيانات بقائمة الأصول المدعومة (من config/assets.ts).
 * يعمل تلقائيًا بعد `npx prisma migrate dev` على قاعدة جديدة، أو يدويًا: `npm run db:seed`.
 * لا يُنشئ أي بيانات سوق أو تقارير وهمية.
 */
import { PrismaClient } from "@prisma/client";
import { ASSETS } from "../src/config/assets";

const prisma = new PrismaClient();

async function main() {
  for (const a of ASSETS) {
    await prisma.asset.upsert({
      where: { symbol: a.symbol },
      update: { name: a.name, nameAr: a.nameAr, kind: a.kind, coingeckoId: a.coingeckoId ?? null, binanceSymbol: a.binanceSymbol ?? null },
      create: { symbol: a.symbol, name: a.name, nameAr: a.nameAr, kind: a.kind, coingeckoId: a.coingeckoId ?? null, binanceSymbol: a.binanceSymbol ?? null },
    });
  }
  console.log(`✓ تمت إضافة/تحديث ${ASSETS.length} أصلًا`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
