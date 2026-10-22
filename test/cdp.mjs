/**
 * Стенд для проверки расширения в настоящем Chrome через CDP.
 * Использует Extensions.loadUnpacked (Chrome 125+).
 *
 *   node test/cdp.mjs [--shot out.png] [--eval "выражение"]
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DIST = path.resolve(process.cwd(), "dist");
const PORT = 9334;

const args = process.argv.slice(2);
const shotIndex = args.indexOf("--shot");
const shotPath = shotIndex >= 0 ? args[shotIndex + 1] : null;
const evalIndex = args.indexOf("--eval");
const evalExpr = evalIndex >= 0 ? args[evalIndex + 1] : null;
const popupIndex = args.indexOf("--popup");
const popupPath = popupIndex >= 0 ? args[popupIndex + 1] : "popup.html";

const profile = `/tmp/cdp-profile-${Date.now()}`;
await mkdir(profile, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return await response.json();
    } catch {
      /* ещё не поднялся */
    }
    await sleep(250);
  }
  throw new Error("DevTools не поднялся");
}

let messageId = 0;
function cdpClient(socket) {
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++messageId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
}

const version = await waitForDevtools();
const browserSocket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve) => browserSocket.addEventListener("open", resolve));
const browserSend = cdpClient(browserSocket);

// 1. загружаем расширение
const loaded = await browserSend("Extensions.loadUnpacked", { path: DIST });
const extensionId = loaded.result?.id;
if (!extensionId) {
  console.error("Extensions.loadUnpacked не сработал:", JSON.stringify(loaded).slice(0, 400));
  chrome.kill();
  process.exit(1);
}
console.log(`extension id: ${extensionId}`);

// 2. открываем страницу popup
const created = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/${popupPath}`)}`, {
    method: "PUT",
  })
).json();

const socket = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve));
const send = cdpClient(socket);
await send("Runtime.enable");
await send("Page.enable");
await sleep(1500);

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.result?.exceptionDetails) {
    return `ОШИБКА: ${result.result.exceptionDetails.text} ${
      result.result.exceptionDetails.exception?.description ?? ""
    }`;
  }
  return result.result?.result?.value;
};

// проверка из service worker: что он видит в session storage
const swEvalIndex = args.indexOf("--sw-eval");
if (swEvalIndex >= 0) {
  const swExpr = args[swEvalIndex + 1];
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const swTarget = targets.find((t) => t.type === "service_worker" && t.url.includes(extensionId));
  if (!swTarget) {
    console.log("SW-цель не найдена");
  } else {
    const swSocket = new WebSocket(swTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => swSocket.addEventListener("open", resolve));
    const swSend = cdpClient(swSocket);
    await swSend("Runtime.enable");
    const swResult = await swSend("Runtime.evaluate", {
      expression: swExpr,
      returnByValue: true,
      awaitPromise: true,
    });
    console.log("sw eval:", swResult.result?.result?.value ?? JSON.stringify(swResult).slice(0, 300));
    swSocket.close();
  }
}

if (evalExpr) {
  console.log("eval:", await evaluate(evalExpr));
} else {
  console.log(
    await evaluate(`JSON.stringify({
  url: location.href,
  bodyText: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 500),
  scrollHeight: document.documentElement.scrollHeight,
  innerWidth: window.innerWidth,
}, null, 2)`),
  );
}

if (shotPath) {
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  if (shot.result?.data) {
    await writeFile(shotPath, Buffer.from(shot.result.data, "base64"));
    console.log(`скриншот: ${shotPath}`);
  }
}

socket.close();
browserSocket.close();
chrome.kill();
await sleep(300);
process.exit(0);
