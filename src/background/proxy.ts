/** Работа с прокси: получение конфигурации, применение PAC, снятие настроек. */

import { apiRequest } from "../shared/api";
import { getDeviceId, getDeviceIp } from "./device";
import { StorageKey } from "../shared/constants";
import { buildPacScript, DEFAULT_RULES } from "../shared/rules";
import { browserApi, callApi } from "../shared/browser";
import { getValue, setValue } from "../shared/storage";
import type { ProxyConfig, ProxyCredentials, ProxyRulesSettings, ProxyServer } from "../shared/types";

/** Запрашивает у API конфигурацию прокси для текущего устройства. */
export async function fetchProxyConfig(publicRequestId: string): Promise<ProxyConfig> {
  const deviceId = await getDeviceId();
  const deviceIp = await getDeviceIp();

  const response = await apiRequest<ProxyConfig>("post", "get_proxy", {
    json: { deviceId, deviceIp, publicRequestId },
  });

  return {
    proxies: Array.isArray(response?.proxies) ? response.proxies : [],
    userProxyCredentials: {
      login: response?.userProxyCredentials?.login ?? "",
      password: response?.userProxyCredentials?.password ?? "",
    },
  };
}

/** Текущие правила выборочного проксирования. */
export async function getRules(): Promise<ProxyRulesSettings> {
  const stored = await getValue<ProxyRulesSettings>("local", StorageKey.ProxyRules, DEFAULT_RULES);
  return {
    mode: stored?.mode === "listed" ? "listed" : "all",
    rules: Array.isArray(stored?.rules) ? stored.rules : [],
  };
}

/** Применяет прокси (PAC-скрипт) с учётом правил. */
export async function applyProxy(
  proxies: ProxyServer[],
  previousProxies: ProxyServer[] = [],
): Promise<void> {
  const rules = await getRules();
  const all = [...proxies, ...previousProxies];
  const pacScript = buildPacScript({ proxies: all, mode: rules.mode, rules: rules.rules });

  await callApi<void>(
    browserApi.proxy?.settings?.set,
    browserApi.proxy?.settings,
    [
      {
        value: {
          mode: "pac_script",
          pacScript: { data: pacScript, mandatory: true },
        },
      },
    ],
  );
}

/** Снимает настройки прокси. */
export async function clearProxy(): Promise<void> {
  await callApi<void>(browserApi.proxy?.settings?.clear, browserApi.proxy?.settings, [{}]);
}

/**
 * Сохраняет прокси и учётные данные в хранилище.
 * Список лежит в local, а не в session: session-хранилище стирается при
 * перезапуске браузера, и адрес прокси пропадал бы из технической информации.
 */
export async function saveProxyData(
  proxies: ProxyServer[],
  credentials: ProxyCredentials,
): Promise<void> {
  await setValue("local", StorageKey.ProxyList, proxies);
  await setValue("local", StorageKey.ProxyCredentials, credentials);
}

/** Читает сохранённые прокси и учётные данные. */
export async function loadProxyData(): Promise<{
  proxies: ProxyServer[];
  credentials: ProxyCredentials | null;
}> {
  const proxies = await getValue<ProxyServer[]>("local", StorageKey.ProxyList, []);
  const credentials = await getValue<ProxyCredentials | null>(
    "local",
    StorageKey.ProxyCredentials,
    null,
  );
  return { proxies: proxies ?? [], credentials };
}

/** Удаляет сохранённые прокси и учётные данные. */
export async function clearProxyData(): Promise<void> {
  await setValue("local", StorageKey.ProxyList, []);
  await setValue("local", StorageKey.ProxyCredentials, null);
}

/** Контролирует ли прокси наше расширение (нет конфликта с другим расширением). */
export async function isProxyControlledByUs(): Promise<boolean> {
  try {
    const settings = await callApi<{ levelOfControl?: string }>(
      browserApi.proxy?.settings?.get,
      browserApi.proxy?.settings,
      [{}],
    );
    return settings?.levelOfControl === "controlled_by_this_extension";
  } catch (error) {
    console.error("Не удалось проверить настройки прокси:", error);
    return false;
  }
}
