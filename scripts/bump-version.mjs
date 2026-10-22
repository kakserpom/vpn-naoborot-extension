/**
 * Поднимает patch-версию расширения в манифесте.
 *
 * Chrome не обновляет уже установленный CRX, если версия не выросла,
 * поэтому перед каждой упаковкой версию нужно увеличить.
 *
 *   node scripts/bump-version.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const manifestPath = path.join(process.cwd(), "public", "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const [major, minor, patch] = String(manifest.version ?? "0.0.0").split(".").map(Number);
const next = `${major}.${minor}.${(Number.isFinite(patch) ? patch : 0) + 1}`;

manifest.version = next;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`версия: ${next}`);
