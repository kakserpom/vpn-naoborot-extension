/**
 * Дымовой тест popup: собирает интерфейс через Vite и проверяет,
 * что он рендерится без ошибок в jsdom с mocked WebExtension API.
 *
 *   node test/popup.test.mjs
 */

import assert from "node:assert/strict";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const outdir = path.join(process.cwd(), "test", ".tmp", "popup");
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const build = (await import("vite")).build;
const solid = (await import("vite-plugin-solid")).default;

await build({
  logLevel: "error",
  plugins: [solid()],
  build: {
    outDir: outdir,
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: { input: path.join(process.cwd(), "src/popup/index.tsx") },
    lib: {
      entry: path.join(process.cwd(), "src/popup/index.tsx"),
      formats: ["es"],
      fileName: () => "popup.js",
    },
  },
});

const bundlePath = path.join(outdir, "popup.js");

/** Простая реализация chrome.storage в памяти. */
function createStorage(initial = {}) {
  const data = { local: { ...initial }, session: {} };
  const listeners = [];

  const area = (name) => ({
    get: (key, callback) => {
      const result = key in data[name] ? { [key]: data[name][key] } : {};
      callback?.(result);
      return Promise.resolve(result);
    },
    set: (items, callback) => {
      Object.assign(data[name], items);
      for (const [changedKey, change] of Object.entries(items)) {
        for (const listener of listeners) {
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

  return {
    data,
    area,
    onChanged: {
      addListener: (listener) => listeners.push(listener),
      removeListener: (listener) => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
    },
  };
}

function setupDom(storage, tabUrl = "") {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: "chrome-extension://test-extension/popup.html",
    pretendToBeVisual: true,
  });

  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
  global.Event = dom.window.Event;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.getComputedStyle = dom.window.getComputedStyle;
  global.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);

  const sentMessages = [];

  global.chrome = {
    runtime: {
      id: "test-extension",
      lastError: undefined,
      sendMessage: (message, callback) => {
        sentMessages.push(message);
        callback?.({ ok: true });
        return Promise.resolve({ ok: true });
      },
      onMessage: { addListener: () => {} },
    },
    storage: {
      local: storage.area("local"),
      session: storage.area("session"),
      onChanged: storage.onChanged,
    },
    action: {
      setIcon: (details, callback) => {
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
      onAlarm: { addListener: () => {} },
    },
    proxy: {
      settings: {
        get: (details, callback) => {
          callback?.({});
          return Promise.resolve({});
        },
        set: (details, callback) => {
          callback?.();
          return Promise.resolve();
        },
        clear: (details, callback) => {
          callback?.();
          return Promise.resolve();
        },
      },
    },
    webRequest: { onAuthRequired: { addListener: () => {} } },
    tabs: {
      query: (query, callback) => {
        const tabs = tabUrl ? [{ id: 1, url: tabUrl }] : [];
        callback?.(tabs);
        return Promise.resolve(tabs);
      },
    },
  };

  return { dom, sentMessages };
}

const tick = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- сценарий 1
console.log("popup: экран авторизации");
{
  const storage = createStorage();
  const { dom, sentMessages } = setupDom(storage);

  const requests = [];
  global.fetch = async (url, init) => {
    const target = String(url);
    requests.push(target);
    const payload = target.includes("user_data")
      ? {
          data: {
            request: {
              public_request_id: "req-123",
              paid_until: null,
              simplified_status: "paid",
            },
          },
        }
      : {};
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => "",
    };
  };

  await import(`${pathToFileURL(bundlePath).href}?case=1`);
  await tick(120);

  const body = dom.window.document.body.textContent ?? "";
  assert.ok(body.includes("Вход"), "ожидался заголовок «Вход»");
  assert.ok(body.includes("Получить код"), "ожидалась кнопка «Получить код»");
  assert.ok(body.includes("VPN Наоборот"), "ожидался заголовок в шапке");
  assert.ok(sentMessages.length === 0, "сообщений в фон отправляться не должно");

  // вводим email и отправляем форму
  const input = dom.window.document.querySelector('input[type="email"]');
  assert.ok(input, "ожидалось поле email");
  input.value = "user@example.com";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await tick(20);

  const form = dom.window.document.querySelector("form");
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(120);

  assert.ok(
    requests.some((url) => url.includes("auth/request_email_verification")),
    `ожидался запрос кода, были запросы: ${requests.join(", ")}`,
  );
  const body2 = dom.window.document.body.textContent ?? "";
  assert.ok(body2.includes("Код из письма"), "ожидался шаг ввода кода");

  // вводим код и отправляем
  const otpInputs = [...dom.window.document.querySelectorAll('input[maxlength="4"]')];
  assert.equal(otpInputs.length, 4, "ожидались четыре поля для кода");
  otpInputs.forEach((field, index) => {
    field.value = String(index + 1);
    field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await tick(40);

  const otpForm = [...dom.window.document.querySelectorAll("form")].find((form) =>
    form.querySelector('input[maxlength="4"]'),
  );
  otpForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(120);

  assert.ok(
    requests.some((url) => url.includes("user_data")),
    `ожидался запрос user_data, были запросы: ${requests.join(", ")}`,
  );

  // после успешного ввода кода открывается главный экран
  const body3 = dom.window.document.body.textContent ?? "";
  assert.ok(body3.includes("user@example.com"), "ожидалась почта пользователя");
  assert.ok(
    body3.includes("Только сайты из списка"),
    "ожидался блок режимов проксирования",
  );
  assert.equal(
    storage.data.local.subscription?.publicRequestId,
    "req-123",
    "подписка должна сохраниться в хранилище",
  );
}

// ---------------------------------------------------------------- сценарий 2
console.log("popup: главный экран");
{
  const storage = createStorage({
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
  });
  const { dom, sentMessages } = setupDom(storage);
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  });

  await import(`${pathToFileURL(bundlePath).href}?case=2`);
  await tick(120);

  const body = dom.window.document.body.textContent ?? "";
  assert.ok(body.includes("user@example.com"), "ожидалась почта пользователя");
  // сворачиваемой панели больше нет — режимы прямо на верхнем уровне
  assert.ok(
    !body.includes("Список пуст"),
    "сворачиваемой панели «Выборочное проксирование» быть не должно",
  );
  assert.ok(
    body.includes("Только сайты из списка"),
    "ожидалась кнопка режима «Только сайты из списка»",
  );
  assert.ok(body.includes("gosuslugi.ru"), "список сайтов виден сразу, без раскрытия");

  // режим «Только сайты из списка» идёт раньше «Все сайты через VPN»
  const modeButtons = [...dom.window.document.querySelectorAll("button")].filter((button) =>
    /Все сайты через VPN|Только сайты из списка/.test(button.textContent ?? ""),
  );
  assert.equal(modeButtons.length, 2, "ожидались две кнопки режима");
  assert.ok(
    (modeButtons[0].textContent ?? "").includes("Только сайты из списка"),
    "первой должна идти кнопка «Только сайты из списка»",
  );
  assert.ok(modeButtons[0].className.includes("border-primary"), "режим listed должен быть выбран");

  // переключение режима
  const allModeButton = modeButtons.find((button) =>
    (button.textContent ?? "").includes("Все сайты через VPN"),
  );
  assert.ok(allModeButton, "ожидалась кнопка режима «Все сайты через VPN»");
  allModeButton.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  await tick(60);
  assert.equal(
    storage.data.local.proxyRules.mode,
    "all",
    "режим должен сохраниться в хранилище",
  );

  // добавление домена
  const ruleInput = dom.window.document.querySelector('input[placeholder="gosuslugi.ru"]');
  assert.ok(ruleInput, "ожидалось поле ввода домена");
  ruleInput.value = "https://kinopoisk.ru";
  ruleInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await tick(20);
  const forms = [...dom.window.document.querySelectorAll("form")];
  const ruleForm = forms.find((form) => form.querySelector('input[placeholder="gosuslugi.ru"]'));
  ruleForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(80);
  assert.deepEqual(
    storage.data.local.proxyRules.rules.map((rule) => rule.domain),
    ["kinopoisk.ru", "gosuslugi.ru"],
    "новый домен должен оказаться в начале списка",
  );

  // переключение прокси
  const connectButton = dom.window.document.querySelector('button[aria-label="Подключить VPN"]');
  assert.ok(connectButton, "ожидалась кнопка подключения");
  connectButton.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  await tick(60);
  assert.ok(
    sentMessages.some((message) => message?.type === "toggleProxy"),
    "ожидалось сообщение toggleProxy в фон",
  );
}

// ---------------------------------------------------------------- сценарий 3
console.log("popup: добавление текущего сайта");
{
  // 3а) пустое поле + «Добавить» добавляет сайт активной вкладки «через VPN»
  const storage = createStorage({
    subscription: {
      email: "user@example.com",
      paidUntil: null,
      publicRequestId: "req-123",
      simplifiedStatus: "paid",
    },
    proxyRules: { mode: "listed", rules: [{ domain: "gosuslugi.ru", action: "proxy" }] },
  });
  const { dom } = setupDom(storage, "https://www.example.com/catalog?x=1");
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  });

  await import(`${pathToFileURL(bundlePath).href}?case=3a`);
  await tick(120);

  // отдельной кнопки «Текущий сайт» больше нет
  const tabButton = [...dom.window.document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").includes("Текущий сайт"),
  );
  assert.ok(!tabButton, "кнопки «Текущий сайт» быть не должно");

  // placeholder показывает домен вкладки без www
  const input = dom.window.document.querySelector('input[aria-label="Домен"]');
  assert.ok(input, "ожидалось поле ввода домена");
  assert.equal(
    input.placeholder,
    "example.com",
    `placeholder должен быть доменом вкладки, был: ${input.placeholder}`,
  );

  // «Добавить» при пустом поле добавляет текущий сайт
  const form = [...dom.window.document.querySelectorAll("form")].find((node) =>
    node.querySelector('input[aria-label="Домен"]'),
  );
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(80);
  assert.deepEqual(
    storage.data.local.proxyRules.rules.find((rule) => rule.domain === "example.com"),
    { domain: "example.com", action: "proxy" },
    "текущий сайт должен добавиться с действием «через VPN»",
  );
  assert.equal(
    storage.data.local.proxyRules.rules.filter((rule) => rule.domain === "example.com").length,
    1,
    "дубликатов быть не должно",
  );
}

{
  // 3б) текущий сайт уже в списке как «напрямую» — «Добавить» переключает на «через VPN»
  const storage = createStorage({
    subscription: {
      email: "user@example.com",
      paidUntil: null,
      publicRequestId: "req-123",
      simplifiedStatus: "paid",
    },
    proxyRules: { mode: "listed", rules: [{ domain: "sberbank.ru", action: "direct" }] },
  });
  const { dom } = setupDom(storage, "https://sberbank.ru/online/");
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  });

  await import(`${pathToFileURL(bundlePath).href}?case=3b`);
  await tick(120);

  const form = [...dom.window.document.querySelectorAll("form")].find((node) =>
    node.querySelector('input[aria-label="Домен"]'),
  );
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(80);
  assert.deepEqual(
    storage.data.local.proxyRules.rules.find((rule) => rule.domain === "sberbank.ru"),
    { domain: "sberbank.ru", action: "proxy" },
    "домен должен переключиться с «напрямую» на «через VPN»",
  );
}

{
  // 3в) системная вкладка (chrome://): placeholder дефолтный, пустое поле даёт ошибку
  const storage = createStorage({
    subscription: {
      email: "user@example.com",
      paidUntil: null,
      publicRequestId: "req-123",
      simplifiedStatus: "paid",
    },
    proxyRules: { mode: "listed", rules: [] },
  });
  const { dom } = setupDom(storage, "chrome://newtab/");
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  });

  await import(`${pathToFileURL(bundlePath).href}?case=3v`);
  await tick(120);

  const input = dom.window.document.querySelector('input[aria-label="Домен"]');
  assert.equal(
    input.placeholder,
    "gosuslugi.ru",
    "без http(s)-вкладки placeholder должен быть дефолтным",
  );

  const form = [...dom.window.document.querySelectorAll("form")].find((node) =>
    node.querySelector('input[aria-label="Домен"]'),
  );
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(80);
  assert.equal(
    storage.data.local.proxyRules.rules.length,
    0,
    "при пустом поле и системной вкладке правила не добавляются",
  );
  assert.ok(
    (dom.window.document.body.textContent ?? "").includes("Введите домен"),
    "ожидалась подсказка ввести домен",
  );
}

// ---------------------------------------------------------------- сценарий 4
console.log("popup: идемпотентное «Добавить»");
{
  const storage = createStorage({
    subscription: {
      email: "user@example.com",
      paidUntil: null,
      publicRequestId: "req-123",
      simplifiedStatus: "paid",
    },
    proxyRules: {
      mode: "listed",
      rules: [{ domain: "gosuslugi.ru", action: "direct" }],
    },
  });
  const { dom } = setupDom(storage, "https://www.example.com/");
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  });

  await import(`${pathToFileURL(bundlePath).href}?case=4`);
  await tick(120);

  const input = dom.window.document.querySelector('input[aria-label="Домен"]');
  const form = [...dom.window.document.querySelectorAll("form")].find((node) =>
    node.querySelector('input[aria-label="Домен"]'),
  );
  const addBtn = [...form.querySelectorAll("button")].find((b) => b.type === "submit");
  assert.ok(addBtn, "ожидалась кнопка «Добавить»");

  const typeDomain = (value) => {
    input.value = value;
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  };
  const bodyText = () => dom.window.document.body.textContent ?? "";

  // 1) тот же домен, то же действие («напрямую» по умолчанию в select? — нет,
  //    select по умолчанию "proxy", а правило direct) → «Добавить» обновит действие
  typeDomain("gosuslugi.ru");
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(80);
  assert.deepEqual(
    storage.data.local.proxyRules.rules.find((rule) => rule.domain === "gosuslugi.ru"),
    { domain: "gosuslugi.ru", action: "proxy" },
    "действие существующего правила должно обновиться на выбранное",
  );
  assert.equal(
    storage.data.local.proxyRules.rules.filter((r) => r.domain === "gosuslugi.ru").length,
    1,
    "дублей быть не должно",
  );
  assert.ok(!bodyText().includes("уже в списке"), "ошибки быть не должно");
  assert.ok(
    addBtn.className.includes("!bg-green-600"),
    "кнопка должна подсветиться зелёным",
  );
  const checkIcon = addBtn.querySelector("svg");
  assert.ok(checkIcon, "во время подсветки должна показываться галочка");
  assert.ok(
    (checkIcon.classList ?? "").contains
      ? checkIcon.classList.contains("opacity-100")
      : String(checkIcon.className.baseVal ?? checkIcon.className).includes("opacity-100"),
    "галочка должна быть видна во время подсветки",
  );

  // подсветка гаснет примерно через секунду
  await tick(1200);
  assert.ok(
    !addBtn.className.includes("!bg-green-600"),
    "через секунду подсветка должна исчезнуть",
  );

  // 2) повторное «Добавить» с тем же действием — тихий успех без ошибки
  typeDomain("gosuslugi.ru");
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(80);
  assert.deepEqual(
    storage.data.local.proxyRules.rules.map((r) => r.domain),
    ["gosuslugi.ru"],
    "правило не должно дублироваться",
  );
  assert.ok(!bodyText().includes("уже"), "ошибки быть не должно");
}

// ---------------------------------------------------------------- сценарий 5
console.log("popup: «Готовый список» при полном пресете");
{
  // домены пресета извлекаем из исходника, чтобы тест не разминулся с defaults.ts
  const { readFile } = await import("node:fs/promises");
  const defaultsSrc = await readFile(
    path.join(process.cwd(), "src/shared/defaults.ts"),
    "utf8",
  );
  const presetDomains = [...defaultsSrc.matchAll(/"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((d) => d.includes("."));

  const storage = createStorage({
    subscription: {
      email: "user@example.com",
      paidUntil: null,
      publicRequestId: "req-123",
      simplifiedStatus: "paid",
    },
    proxyRules: {
      mode: "listed",
      rules: presetDomains.map((domain) => ({ domain, action: "proxy" })),
    },
  });
  const { dom } = setupDom(storage, "https://www.example.com/");
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  });

  await import(`${pathToFileURL(bundlePath).href}?case=5`);
  await tick(150);

  const bodyText = () => dom.window.document.body.textContent ?? "";
  assert.ok(!bodyText().includes("Готовый список"), "кнопка «Готовый список» должна скрыться");
  assert.ok(bodyText().includes("Очистить список"), "кнопка очистки должна остаться");

  // очистка возвращает кнопку «Готовый список»
  const clearBtn = [...dom.window.document.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes("Очистить список"),
  );
  clearBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  await tick(120);
  assert.ok(bodyText().includes("Готовый список"), "после очистки кнопка должна вернуться");
  assert.equal(
    storage.data.local.proxyRules.rules.length,
    0,
    "после очистки список правил должен опустеть",
  );
}

// ---------------------------------------------------------------- сценарий 6
console.log("popup: «Готовый список» не перезаписывает правила");
{
  const { readFile } = await import("node:fs/promises");
  const defaultsSrc = await readFile(
    path.join(process.cwd(), "src/shared/defaults.ts"),
    "utf8",
  );
  const presetDomains = [...defaultsSrc.matchAll(/"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((d) => d.includes("."));

  const storage = createStorage({
    subscription: {
      email: "user@example.com",
      paidUntil: null,
      publicRequestId: "req-123",
      simplifiedStatus: "paid",
    },
    proxyRules: {
      mode: "listed",
      // sberbank.ru из пресета пользователь настроил «напрямую»,
      // плюс своё личное правило, отсутствующее в пресете
      rules: [
        { domain: "sberbank.ru", action: "direct" },
        { domain: "my-bank.example", action: "proxy" },
      ],
    },
  });
  const { dom } = setupDom(storage, "https://www.example.com/");
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  });

  await import(`${pathToFileURL(bundlePath).href}?case=6`);
  await tick(150);

  const presetBtn = [...dom.window.document.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes("Готовый список"),
  );
  presetBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  await tick(150);

  const rules = storage.data.local.proxyRules.rules;
  const byDomain = (name) => rules.find((rule) => rule.domain === name);

  // пометка «напрямую» сохранилась, действия не перезаписаны
  assert.deepEqual(
    byDomain("sberbank.ru"),
    { domain: "sberbank.ru", action: "direct" },
    "пользовательская пометка «напрямую» должна сохраниться",
  );
  assert.deepEqual(
    byDomain("my-bank.example"),
    { domain: "my-bank.example", action: "proxy" },
    "личное правило должно сохраниться без изменений",
  );
  // все домены пресета на месте, без дублей
  assert.equal(rules.length, presetDomains.length + 1, "ровно пресет + личное правило");
  assert.ok(
    presetDomains.every((domain) => !!byDomain(domain)),
    "все домены пресета должны быть в списке",
  );
  // новые домены пресета — в начале списка
  assert.equal(rules[0].domain, presetDomains[0], "новые домены пресета должны быть сверху");
}

console.log("\nВсе сценарии popup прошли");
