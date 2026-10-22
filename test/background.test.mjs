/**
 * Тест фонового скрипта: включение/отключение прокси и применение
 * правил выборочного проксирования в PAC-скрипт.
 *
 *   node test/background.test.mjs
 */

import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outdir = path.join(process.cwd(), "test", ".tmp");
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const outfile = path.join(outdir, "background.mjs");
await build({
  entryPoints: [path.join(process.cwd(), "src/background/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  logLevel: "warning",
});

// ------------------------------------------------------------- мок chrome

const data = {
  local: {
    subscription: {
      email: "user@example.com",
      paidUntil: null,
      publicRequestId: "req-123",
      simplifiedStatus: "paid",
    },
    connectionState: "disconnected",
    proxyRules: {
      mode: "listed",
      rules: [{ domain: "gosuslugi.ru", action: "proxy" }],
    },
    deviceId: "device-1",
    deviceIp: "1.2.3.4",
  },
  session: {},
};

const listeners = { message: [], alarm: [], auth: [], proxyChange: [] };
const calls = { proxySet: [], proxyClear: 0, icon: [] };

const area = (name) => ({
  get: (key, callback) => {
    const result = key in data[name] ? { [key]: data[name][key] } : {};
    callback?.(result);
    return Promise.resolve(result);
  },
  set: (items, callback) => {
    Object.assign(data[name], items);
    for (const [changedKey, change] of Object.entries(items)) {
      for (const listener of listeners.storageChanged ?? []) {
        listener({ [changedKey]: { newValue: change } }, name);
      }
    }
    callback?.();
    return Promise.resolve();
  },
  remove: (key, callback) => {
    delete data[name][key];
    callback?.();
    return Promise.resolve();
  },
  clear: (callback) => {
    data[name] = {};
    callback?.();
    return Promise.resolve();
  },
});

global.chrome = {
  runtime: {
    id: "test-extension",
    lastError: undefined,
    sendMessage: (message, callback) => {
      callback?.({});
      return Promise.resolve({});
    },
    onMessage: {
      addListener: (listener) => listeners.message.push(listener),
    },
  },
  storage: {
    local: area("local"),
    session: area("session"),
    onChanged: {
      addListener: (listener) => {
        listeners.storageChanged ??= [];
        listeners.storageChanged.push(listener);
      },
      removeListener: () => {},
    },
  },
  action: {
    setIcon: (details, callback) => {
      calls.icon.push(details.path);
      callback?.();
      return Promise.resolve();
    },
    openPopup: (callback) => {
      callback?.();
      return Promise.resolve();
    },
  },
  alarms: {
    create: (name, info, callback) => {
      callback?.();
      return Promise.resolve();
    },
    onAlarm: { addListener: (listener) => listeners.alarm.push(listener) },
  },
  proxy: {
    settings: {
      get: (details, callback) => {
        callback?.({ levelOfControl: "controlled_by_this_extension" });
        return Promise.resolve({});
      },
      set: (details, callback) => {
        calls.proxySet.push(details);
        callback?.();
        return Promise.resolve();
      },
      clear: (details, callback) => {
        calls.proxyClear++;
        callback?.();
        return Promise.resolve();
      },
      onChange: { addListener: (listener) => listeners.proxyChange.push(listener) },
    },
  },
  webRequest: {
    onAuthRequired: { addListener: (listener) => listeners.auth.push(listener) },
  },
};

const requests = [];
global.fetch = async (url, init) => {
  const target = String(url);
  requests.push({ url: target, init });
  if (target.includes("get_proxy")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        proxies: [{ host: "proxy.example", port: 8080 }],
        userProxyCredentials: { login: "user", password: "secret" },
      }),
      text: async () => "",
    };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  };
};

// --------------------------------------------------------------- запуск

await import(pathToFileURL(outfile).href);
await new Promise((resolve) => setTimeout(resolve, 100));

const tick = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

/** Отправляет сообщение в фоновый скрипт, как это делает popup. */
function sendMessage(message) {
  return new Promise((resolve) => {
    for (const listener of listeners.message) {
      const result = listener(message, {}, resolve);
      if (result === true) return;
    }
    resolve(undefined);
  });
}

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

console.log("фон: запуск");
await check("слушатель сообщений зарегистрирован", () => {
  assert.ok(listeners.message.length > 0, "не найден onMessage");
});
await check("будильники созданы", () => {
  assert.ok(listeners.alarm.length > 0, "не найден onAlarm");
});
await check("иконка обновлена при старте", () => {
  assert.ok(calls.icon.includes("icon-128-disabled.png"), "иконка не выставлена");
});

console.log("фон: включение прокси");
await sendMessage({ type: "toggleProxy" });
await tick(200);

await check("запрошены прокси у API", () => {
  assert.ok(
    requests.some((request) => request.url.includes("get_proxy")),
    `ожидался запрос get_proxy, были: ${requests.map((r) => r.url).join(", ")}`,
  );
});

await check("прокси применён через PAC", () => {
  assert.equal(calls.proxySet.length, 1, "ожидался один вызов proxy.settings.set");
  const value = calls.proxySet[0].value;
  assert.equal(value.mode, "pac_script");
  assert.ok(value.pacScript.data.includes("FindProxyForURL"), "нет PAC-скрипта");
});

await check("PAC содержит правила и режим", () => {
  const pac = calls.proxySet[0].value.pacScript.data;
  assert.ok(pac.includes("gosuslugi.ru"), "в PAC нет домена из списка");
  assert.ok(pac.includes('"listed"'), "в PAC нет выбранного режима");
  assert.ok(pac.includes("PROXY proxy.example:8080"), "в PAC нет адреса прокси");
});

await check("PAC в ASCII — Chrome иначе отклоняет скрипт", () => {
  const pac = calls.proxySet[0].value.pacScript.data;
  assert.ok(/^[\x00-\x7F]*$/.test(pac), "в PAC есть не-ASCII символы");
});

await check("состояние переключилось на connected", () => {
  assert.equal(data.local.connectionState, "connected");
});

await check("учётные данные сохранены", () => {
  assert.deepEqual(data.local.proxyCredentials, { login: "user", password: "secret" });
  // список прокси лежит в local, чтобы не пропадать при перезапуске браузера
  assert.deepEqual(data.local.proxyList, [{ host: "proxy.example", port: 8080 }]);
});

console.log("фон: изменение правил");
await area("local").set({
  proxyRules: {
    mode: "all",
    rules: [{ domain: "gosuslugi.ru", action: "direct" }],
  },
});
await tick(200);

await check("PAC пересобран после изменения правил", () => {
  assert.equal(calls.proxySet.length, 2, "ожидалась пересборка PAC");
  const pac = calls.proxySet[1].value.pacScript.data;
  assert.ok(pac.includes('"all"'), "в PAC нет нового режима");
});

console.log("фон: отключение прокси");
await sendMessage({ type: "disableProxy" });
await tick(200);

await check("настройки прокси сняты", () => {
  assert.equal(calls.proxyClear, 1, "ожидался вызов proxy.settings.clear");
  assert.equal(data.local.connectionState, "disconnected");
});

console.log(`\n${passed} проверок пройдено`);
