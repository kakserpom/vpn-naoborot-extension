/**
 * Запуск тестов без дополнительных зависимостей:
 * esbuild собирает TypeScript-файл в один JS-модуль, затем он выполняется в Node.
 *
 *   node test/run.mjs
 */

import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const outdir = path.join(process.cwd(), "test", ".tmp");
await mkdir(outdir, { recursive: true });

const entry = process.argv[2] ?? "test/rules.test.ts";
const outfile = path.join(outdir, path.basename(entry).replace(/\.ts$/, ".mjs"));

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  logLevel: "warning",
});

await import(pathToFileURL(outfile).href);
