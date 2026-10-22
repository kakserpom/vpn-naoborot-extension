/**
 * Вариант манифеста для Firefox: там `background.service_worker` не поддерживается,
 * а `background.scripts` в MV3 запрещён Chrome — поэтому у каждого браузера свой ключ.
 *
 *   node scripts/manifest-firefox.mjs [distDir]
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const distDir = process.argv[2] ?? "dist";
const manifestPath = path.join(distDir, "manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

manifest.background = { scripts: ["background.js"] };

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Манифест для Firefox: ${manifestPath}`);
