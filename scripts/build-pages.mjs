#!/usr/bin/env node
/**
 * بناء النسخة الثابتة لـ GitHub Pages (مجلد out/).
 * مسارات الـ API والوسيط تحتاج خادمًا ولا يدعمها التصدير الثابت، لذلك تُنقل مؤقتًا
 * خارج src أثناء البناء ثم تُعاد دائمًا (حتى عند الفشل).
 *
 * الاستخدام:  NEXT_PUBLIC_BASE_PATH=/Ai_crypto npm run build:pages
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const stash = path.join(root, "node_modules", ".cache", "static-excluded");
const SERVER_ONLY = ["src/app/api", "src/middleware.ts"];

rmSync(stash, { recursive: true, force: true });
mkdirSync(stash, { recursive: true });

const moved = [];
let status = 1;
try {
  for (const rel of SERVER_ONLY) {
    const from = path.join(root, rel);
    if (!existsSync(from)) continue;
    const to = path.join(stash, rel.replace(/\//g, "__"));
    renameSync(from, to);
    moved.push([from, to]);
  }
  rmSync(path.join(root, ".next"), { recursive: true, force: true });
  const env = {
    ...process.env,
    NEXT_PUBLIC_STATIC_MODE: "true",
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
    DATA_MODE: "live",
  };
  const res = spawnSync("npx", ["next", "build"], { cwd: root, env, stdio: "inherit" });
  status = res.status ?? 1;
  if (status === 0) {
    // يمنع معالجة Jekyll التي تتجاهل مجلد _next
    writeFileSync(path.join(root, "out", ".nojekyll"), "");
    aliasDottedRoutes(path.join(root, "out"));
    console.log("\n✓ النسخة الثابتة جاهزة في out/");
  }
} finally {
  for (const [from, to] of moved.reverse()) renameSync(to, from);
  rmSync(path.join(root, ".next"), { recursive: true, force: true });
}
process.exit(status);

/**
 * Next.js يعامل المقطع الأخير الذي يحتوي نقطة (مثل BTC.D) كملف، فيطلب BTC.D.txt بدل BTC.D/index.txt
 * أثناء التنقل، ويُفتح الرابط دون شرطة نهائية. ننسخ الملفين بالاسمين المتوقعين.
 */
function aliasDottedRoutes(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.includes(".")) {
      for (const ext of ["html", "txt"]) {
        const src = path.join(full, `index.${ext}`);
        if (existsSync(src)) copyFileSync(src, path.join(dir, `${entry.name}.${ext}`));
      }
    }
    aliasDottedRoutes(full);
  }
}
