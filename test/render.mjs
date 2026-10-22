/**
 * Визуальный стенд: рендерит popup в jsdom (с mocked API и данными),
 * собирает обычную HTML-страницу со стилями сборки и делает скриншот в Chrome.
 *
 *   node test/render.mjs [out.png] [--state auth|home]
 */

import { build } from "vite";
import solid from "vite-plugin-solid";
import { JSDOM } from "jsdom";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outPng = process.argv[2]?.endsWith(".png") ? process.argv[2] : "/tmp/popup-preview.png";
const args = process.argv.slice(2);
const state = args.includes("auth") ? "auth" : "home";

const outdir = path.join(process.cwd(), "test", ".tmp", "render");
await mkdir(outdir, { recursive: true });

await build({
  logLevel: "error",
  plugins: [solid()],
  build: {
    outDir: outdir,
    emptyOutDir: true,
    target: "es2022",
    lib: {
      entry: path.join(process.cwd(), "src/popup/index.tsx"),
      formats: ["es"],
      fileName: () => "popup.js",
    },
  },
});

const storage = {
  local: {
    subscription: {
      email: "user@example.com",
      paidUntil: "2026-12-31",
      publicRequestId: "req-123",
      simplifiedStatus: "paid",
    },
    connectionState: "connected",
    proxyCredentials: { login: "vpn_user_42", password: "secret" },
    proxyList: [
      { host: "45.132.10.5", port: 8080 },
      { host: "45.132.10.6", port: 8080 },
    ],
    deviceId: "3f2a9c81-77bd-4a11-9d2e-5c8b0a4f6e13",
    deviceIp: "203.0.113.24",
    apiHostIndex: null,
    proxyRules: {
      mode: "listed",
      rules: [
        { domain: "gosuslugi.ru", action: "proxy" },
        { domain: "kinopoisk.ru", action: "direct" },
        { domain: "nalog.ru", action: "proxy" },
      ],
    },
  },
  session: {},
};

if (state === "auth") {
  delete storage.local.subscription;
}

const listeners = [];
const area = (name) => ({
  get: (key, cb) => {
    const r = key in storage[name] ? { [key]: storage[name][key] } : {};
    cb?.(r);
    return Promise.resolve(r);
  },
  set: (items, cb) => {
    Object.assign(storage[name], items);
    for (const [k, v] of Object.entries(items)) {
      for (const l of listeners) l({ [k]: { newValue: v } }, name);
    }
    cb?.();
    return Promise.resolve();
  },
  remove: (k, cb) => {
    delete storage[name][k];
    cb?.();
    return Promise.resolve();
  },
  clear: (cb) => {
    storage[name] = {};
    cb?.();
    return Promise.resolve();
  },
});

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "chrome-extension://test/popup.html",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.Event = dom.window.Event;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.MutationObserver = dom.window.MutationObserver;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

global.chrome = {
  runtime: {
    id: "test",
    lastError: undefined,
    getManifest: () => ({ version: "5.0.0" }),
    sendMessage: (m, cb) => {
      cb?.({ ok: true });
      return Promise.resolve({ ok: true });
    },
    onMessage: { addListener: () => {} },
  },
  storage: {
    local: area("local"),
    session: area("session"),
    onChanged: {
      addListener: (l) => listeners.push(l),
      removeListener: () => {},
    },
  },
  action: { setIcon: (d, cb) => (cb?.(), Promise.resolve()), openPopup: (cb) => (cb?.(), Promise.resolve()) },
  alarms: { create: (n, i, cb) => (cb?.(), Promise.resolve()), onAlarm: { addListener: () => {} } },
  proxy: {
    settings: {
      get: (d, cb) => (cb?.({}), Promise.resolve({})),
      set: (d, cb) => (cb?.(), Promise.resolve()),
      clear: (d, cb) => (cb?.(), Promise.resolve()),
    },
  },
  webRequest: { onAuthRequired: { addListener: () => {} } },
};
global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" });

await import(pathToFileURL(path.join(outdir, "popup.js")).href);
await new Promise((r) => setTimeout(r, 200));

if (args.includes("--expand")) {
  const toggle = [...dom.window.document.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes("Выборочное проксирование"),
  );
  toggle?.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));
  console.log("панель правил раскрыта");
}

if (args.includes("--info")) {
  const infoButton = dom.window.document.querySelector(
    'button[aria-label="Техническая информация"]',
  );
  infoButton?.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 150));
  console.log("окно тех. информации открыто");
}

const cssFile = (await readdir("dist/assets")).find((f) => f.endsWith(".css"));
const css = await readFile(path.join("dist/assets", cssFile), "utf8");
const html = dom.window.document.body.innerHTML;

const page = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
<style>
  html,body{width:312px;margin:0;padding:0}
  /* эмулируем окно popup: фиксированная ширина и позиционирование модалок */
  body > div{position:relative;width:312px;height:540px;overflow:hidden}
  .fixed{position:absolute!important;inset:0}
</style>
<script>setTimeout(()=>{document.title='scrollW='+document.documentElement.scrollWidth+' innerW='+window.innerWidth+' bodyW='+document.body.scrollWidth;},80)</script>
</head><body>${html}</body></html>`;

const pagePath = path.join(outdir, "preview.html");
await writeFile(pagePath, page);
console.log(pagePath);
console.log("текст в popup:", (dom.window.document.body.textContent ?? "").replace(/\s+/g, " ").slice(0, 300));
