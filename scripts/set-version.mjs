/**
 * Задаёт версию расширения в манифесте и package.json в точности как указали.
 *
 * Используется релизным воркфлоу: тег v5.0.9 → версия "5.0.9".
 *
 *   node scripts/set-version.mjs 5.0.9
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const version = process.argv[2];
if (!version || !/^\d+\.\d+(\.\d+)?$/.test(version)) {
  console.error("использование: node scripts/set-version.mjs 5.0.9");
  process.exit(1);
}

const manifestPath = path.join(process.cwd(), "public", "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const pkgPath = path.join(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`версия: ${version}`);
