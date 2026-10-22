/**
 * Тесты доменов и PAC-скрипта.
 * Запуск: node --experimental-strip-types test/rules.test.ts  (или через npm run test)
 */

import assert from "node:assert/strict";
import { buildPacScript, dedupeRules, matchesHost, normalizeDomain } from "../src/shared/rules.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

/** Вычисляет PAC-скрипт в песочнице с реализацией dnsDomainIs. */
function pacEvaluate(script: string, host: string): string {
  const factory = new Function(
    "dnsDomainIs",
    `${script}\nreturn FindProxyForURL("https://${host}/", "${host}");`,
  );
  return factory((hostname: string, domain: string) =>
    hostname.endsWith(`.${domain}`) ? domain : null,
  ) as string;
}

console.log("normalizeDomain");
check("убирает схему и путь", () => {
  assert.equal(normalizeDomain("https://gosuslugi.ru/login?a=1"), "gosuslugi.ru");
});
check("убирает www-префикс как отдельный домен", () => {
  assert.equal(normalizeDomain("www.gosuslugi.ru"), "www.gosuslugi.ru");
});
check("убирает ведущий wildcard", () => {
  assert.equal(normalizeDomain("*.gosuslugi.ru"), "gosuslugi.ru");
});
check("убирает порт", () => {
  assert.equal(normalizeDomain("gosuslugi.ru:443"), "gosuslugi.ru");
});
check("отклоняет мусор", () => {
  assert.equal(normalizeDomain("не домен"), null);
  assert.equal(normalizeDomain("localhost"), null);
  assert.equal(normalizeDomain(""), null);
});

console.log("matchesHost");
check("совпадает сам домен", () => assert.equal(matchesHost("gosuslugi.ru", "gosuslugi.ru"), true));
check("совпадает поддомен", () =>
  assert.equal(matchesHost("www.gosuslugi.ru", "gosuslugi.ru"), true),
);
check("не совпадает другой домен", () =>
  assert.equal(matchesHost("gosuslugi.ru.evil.com", "gosuslugi.ru"), false),
);
check("не совпадает суффикс без точки", () =>
  assert.equal(matchesHost("mygosuslugi.ru", "gosuslugi.ru"), false),
);

console.log("dedupeRules");
check("убирает дубликаты и нормализует", () => {
  const result = dedupeRules([
    { domain: "https://gosuslugi.ru", action: "proxy" },
    { domain: "gosuslugi.ru", action: "direct" },
    { domain: "*.kinopoisk.ru", action: "proxy" },
  ]);
  assert.deepEqual(result, [
    { domain: "gosuslugi.ru", action: "proxy" },
    { domain: "kinopoisk.ru", action: "proxy" },
  ]);
});

console.log("buildPacScript");
const proxies = [
  { host: "proxy1.example", port: 8080 },
  { host: "proxy2.example", port: 8080 },
];
const proxyString = "PROXY proxy1.example:8080; PROXY proxy2.example:8080";

check("скрипт содержит только ASCII (Chrome требует)", () => {
  const script = buildPacScript({
    proxies,
    mode: "all",
    rules: [{ domain: "россия.рф", action: "proxy" }],
  });
  assert.ok(/^[\x00-\x7F]*$/.test(script), "в PAC есть не-ASCII символы");
});

check("кириллический домен кодируется в punycode", () => {
  const script = buildPacScript({
    proxies,
    mode: "listed",
    rules: [{ domain: "россия.рф", action: "proxy" }],
  });
  assert.ok(script.includes("xn--h1alffa9f.xn--p1ai"), "нет punycode-домена");
  // Chrome передаёт в PAC хост в punycode — именно в таком виде он и сравнивается
  assert.equal(pacEvaluate(script, "xn--h1alffa9f.xn--p1ai"), proxyString);
});

check("режим all: всё через прокси", () => {
  const script = buildPacScript({ proxies, mode: "all", rules: [] });
  assert.equal(pacEvaluate(script, "example.com"), proxyString);
});

check("режим all: сайт из списка с direct идёт напрямую", () => {
  const script = buildPacScript({
    proxies,
    mode: "all",
    rules: [{ domain: "gosuslugi.ru", action: "direct" }],
  });
  assert.equal(pacEvaluate(script, "gosuslugi.ru"), "DIRECT");
  assert.equal(pacEvaluate(script, "www.gosuslugi.ru"), "DIRECT");
  assert.equal(pacEvaluate(script, "other.com"), proxyString);
});

check("режим all: сайт из списка с proxy идёт через прокси", () => {
  const script = buildPacScript({
    proxies,
    mode: "all",
    rules: [{ domain: "kinopoisk.ru", action: "proxy" }],
  });
  assert.equal(pacEvaluate(script, "kinopoisk.ru"), proxyString);
});

check("режим listed: только сайты из списка", () => {
  const script = buildPacScript({
    proxies,
    mode: "listed",
    rules: [{ domain: "gosuslugi.ru", action: "proxy" }],
  });
  assert.equal(pacEvaluate(script, "gosuslugi.ru"), proxyString);
  assert.equal(pacEvaluate(script, "www.gosuslugi.ru"), proxyString);
  assert.equal(pacEvaluate(script, "example.com"), "DIRECT");
});

check("режим listed: direct-правило важнее режима", () => {
  const script = buildPacScript({
    proxies,
    mode: "listed",
    rules: [
      { domain: "gosuslugi.ru", action: "proxy" },
      { domain: "nalog.ru", action: "direct" },
    ],
  });
  assert.equal(pacEvaluate(script, "nalog.ru"), "DIRECT");
});

check("API-хост всегда идёт напрямую", () => {
  const script = buildPacScript({ proxies, mode: "all", rules: [] });
  assert.equal(
    pacEvaluate(script, "naoborot-api.naoinfrastructure.com"),
    "DIRECT",
  );
  assert.equal(pacEvaluate(script, "0.naoborot-api.naoinfrastructure.com"), "DIRECT");
});

check("первое совпавшее правило выигрывает", () => {
  const script = buildPacScript({
    proxies,
    mode: "listed",
    rules: [
      { domain: "gosuslugi.ru", action: "proxy" },
      { domain: "gosuslugi.ru", action: "direct" },
    ],
  });
  assert.equal(pacEvaluate(script, "gosuslugi.ru"), proxyString);
});

console.log(`\n${passed} проверок пройдено`);
