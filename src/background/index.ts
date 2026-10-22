/**
 * Service worker расширения «VPN Наоборот».
 *
 * Отвечает за:
 *  - подключение/отключение прокси и переключение;
 *  - авторизацию запросов к прокси (логин/пароль);
 *  - периодическое обновление прокси и данных подписки;
 *  - отслеживание конфликта с другими расширениями, управляющими прокси;
 *  - пересборку PAC-скрипта при изменении правил выборочного проксирования.
 */

import {
  AlarmName,
  API_HOST,
  ConflictStatus,
  ConnectionState,
  MessageType,
  PROXY_REFRESH_MINUTES,
  StorageKey,
  SUBSCRIPTION_REFRESH_MINUTES,
} from "../shared/constants";
import { browserApi, callApi } from "../shared/browser";
import { getValue, setValue, watchValue } from "../shared/storage";
import { apiRequest } from "../shared/api";
import { getDeviceId } from "./device";
import {
  applyProxy,
  clearProxy,
  clearProxyData,
  fetchProxyConfig,
  isProxyControlledByUs,
  loadProxyData,
  saveProxyData,
} from "./proxy";
import type { StatusSnapshot, Subscription, UserDataResponse } from "../shared/types";

// ---------------------------------------------------------------- состояние

async function getCurrentState(): Promise<ConnectionState> {
  const state = await getValue<ConnectionState>(
    "local",
    StorageKey.ConnectionState,
    ConnectionState.Disconnected,
  );
  return state ?? ConnectionState.Disconnected;
}

async function setCurrentState(state: ConnectionState): Promise<void> {
  await setValue("local", StorageKey.ConnectionState, state);
}

async function getConflictStatus(): Promise<ConflictStatus> {
  const status = await getValue<ConflictStatus>(
    "local",
    StorageKey.ConflictStatus,
    ConflictStatus.None,
  );
  return status ?? ConflictStatus.None;
}

// ------------------------------------------------------------------ прокси

/** Проверяет доступ в интернет через прокси. */
async function checkConnectivity(): Promise<void> {
  try {
    await fetch("https://www.google.com/generate_204", { cache: "no-store" });
  } catch (error) {
    console.warn("Проверка соединения не удалась:", error);
  }
}

/** Подключает прокси. */
export async function enableProxy(): Promise<void> {
  const state = await getCurrentState();
  if (state === ConnectionState.Connected || state === ConnectionState.Connecting) return;

  try {
    await setCurrentState(ConnectionState.Connecting);

    const subscription = await getValue<Subscription | null>(
      "local",
      StorageKey.Subscription,
      null,
    );
    if (!subscription?.publicRequestId) {
      throw new Error("Нет активной подписки — войдите в аккаунт");
    }

    const config = await fetchProxyConfig(subscription.publicRequestId);
    if (!config.proxies.length) throw new Error("Сервер не вернул список прокси");

    await saveProxyData(config.proxies, config.userProxyCredentials);
    await applyProxy(config.proxies);
    await setCurrentState(ConnectionState.Connected);
    await checkConnectivity();
  } catch (error) {
    console.error("Не удалось включить прокси:", error);
    await setCurrentState(ConnectionState.Error);
    await clearProxyData();
  }
}

/** Отключает прокси. */
export async function disableProxy(): Promise<void> {
  const state = await getCurrentState();
  if (state === ConnectionState.Disconnected || state === ConnectionState.Error) return;

  try {
    await setCurrentState(ConnectionState.Disconnected);
    await clearProxy();
    await clearProxyData();
  } catch (error) {
    await setCurrentState(ConnectionState.Error);
    console.error("Не удалось отключить прокси:", error);
  }
}

/** Переключает прокси. */
export async function toggleProxy(): Promise<void> {
  const state = await getCurrentState();
  if (state === ConnectionState.Connected) await disableProxy();
  else await enableProxy();
}

/** Обновляет список прокси, если он изменился на сервере. */
async function refreshProxyData(): Promise<void> {
  if ((await getCurrentState()) !== ConnectionState.Connected) return;

  try {
    const subscription = await getValue<Subscription | null>(
      "local",
      StorageKey.Subscription,
      null,
    );
    if (!subscription?.publicRequestId) return;

    const config = await fetchProxyConfig(subscription.publicRequestId);
    const { proxies: previousProxies } = await loadProxyData();

    const changed =
      previousProxies.length !== config.proxies.length ||
      previousProxies.some(
        (proxy, index) =>
          proxy.host !== config.proxies[index]?.host ||
          proxy.port !== config.proxies[index]?.port,
      );

    if (!changed) return;

    await saveProxyData(config.proxies, config.userProxyCredentials);
    await applyProxy(config.proxies, previousProxies);
    await checkConnectivity();
  } catch (error) {
    console.error("Не удалось обновить прокси:", error);
  }
}

// -------------------------------------------------------------- подписка

/** Обновляет данные подписки с сервера. */
async function refreshSubscriptionData(): Promise<void> {
  const subscription = await getValue<Subscription | null>(
    "local",
    StorageKey.Subscription,
    null,
  );
  if (!subscription?.publicRequestId) return;

  try {
    const response = await apiRequest<UserDataResponse>("get", "user_data", {
      searchParams: { public_request_id: subscription.publicRequestId },
    });
    const request = response?.data?.request;
    if (!request) return;

    const updated: Subscription = {
      email: subscription.email,
      paidUntil: request.paid_until ?? null,
      publicRequestId: request.public_request_id,
      simplifiedStatus: request.simplified_status,
    };
    await setValue("local", StorageKey.Subscription, updated);

    if (isExpired(updated)) await disableProxy();
  } catch (error) {
    console.error("Не удалось обновить данные подписки:", error);
  }
}

function isExpired(subscription: Subscription): boolean {
  if (!subscription.paidUntil) return false;
  return new Date(subscription.paidUntil).getTime() <= Date.now();
}

// ---------------------------------------------------------------- будильники

async function setupAlarms(): Promise<void> {
  const alarms = browserApi.alarms;
  if (!alarms) return;

  await callApi<void>(alarms.create, alarms, [
    AlarmName.UpdateProxyData,
    { delayInMinutes: PROXY_REFRESH_MINUTES, periodInMinutes: PROXY_REFRESH_MINUTES },
  ]);
  await callApi<void>(alarms.create, alarms, [
    AlarmName.UpdateSubscriptionData,
    {
      delayInMinutes: SUBSCRIPTION_REFRESH_MINUTES,
      periodInMinutes: SUBSCRIPTION_REFRESH_MINUTES,
    },
  ]);
}

function setupAlarmListener(): void {
  browserApi.alarms?.onAlarm?.addListener((alarm: { name?: string }) => {
    if (alarm.name === AlarmName.UpdateProxyData) void refreshProxyData();
    if (alarm.name === AlarmName.UpdateSubscriptionData) void refreshSubscriptionData();
  });
}

// ------------------------------------------------------- авторизация прокси

function setupProxyAuthListener(): void {
  const webRequest = browserApi.webRequest;
  if (!webRequest?.onAuthRequired) return;

  webRequest.onAuthRequired.addListener(
    (details: { isProxy?: boolean }, callback?: (response: unknown) => void) => {
      void (async () => {
        if (!details?.isProxy) {
          callback?.({});
          return;
        }
        const { credentials } = await loadProxyData();
        if (!credentials?.login) {
          callback?.({ cancel: true });
          return;
        }
        callback?.({
          authCredentials: { username: credentials.login, password: credentials.password },
        });
      })();
      // запрос обрабатывается асинхронно
      return true;
    },
    { urls: ["<all_urls>"] },
    ["asyncBlocking"],
  );
}

// -------------------------------------------------------- конфликт прокси

async function checkProxyConflict(): Promise<void> {
  try {
    const controlled = await isProxyControlledByUs();
    if (controlled) {
      if ((await getConflictStatus()) === ConflictStatus.Detected) {
        await setValue("local", StorageKey.ConflictStatus, ConflictStatus.None);
      }
      return;
    }

    if ((await getCurrentState()) !== ConnectionState.Connected) return;

    console.warn("Настройки прокси контролирует другое расширение");
    await setCurrentState(ConnectionState.Disconnected);
    await setValue("local", StorageKey.ConflictStatus, ConflictStatus.Detected);
    await openPopup();
  } catch (error) {
    console.error("Ошибка проверки конфликта прокси:", error);
  }
}

async function openPopup(): Promise<void> {
  try {
    await callApi<void>(browserApi.action?.openPopup, browserApi.action, []);
  } catch {
    /* действие недоступно в текущем браузере */
  }
}

function setupProxyConflictWatcher(): void {
  browserApi.proxy?.settings?.onChange?.addListener(() => {
    void checkProxyConflict();
  });
}

// -------------------------------------------------------------- иконка

async function updateIcon(): Promise<void> {
  try {
    const state = await getCurrentState();
    const path =
      state === ConnectionState.Connected ? "icon-128.png" : "icon-128-disabled.png";
    await callApi<void>(browserApi.action?.setIcon, browserApi.action, [{ path }]);
  } catch (error) {
    console.error("Не удалось обновить иконку:", error);
  }
}

// ------------------------------------------------------------ сообщения

function setupMessageListener(): void {
  browserApi.runtime?.onMessage?.addListener(
    (message: { type?: string }, _sender: unknown, sendResponse: (value: unknown) => void) => {
      switch (message?.type) {
        case MessageType.ToggleProxy:
          void toggleProxy().then(() => sendResponse({ ok: true }));
          return true;
        case MessageType.EnableProxy:
          void enableProxy().then(() => sendResponse({ ok: true }));
          return true;
        case MessageType.DisableProxy:
          void disableProxy().then(() => sendResponse({ ok: true }));
          return true;
        case MessageType.RulesChanged:
          void reapplyProxyRules().then(() => sendResponse({ ok: true }));
          return true;
        case MessageType.GetStatus:
          void (async () => {
            const snapshot: StatusSnapshot = {
              state: await getCurrentState(),
              conflict: await getConflictStatus(),
            };
            sendResponse(snapshot);
          })();
          return true;
        default:
          return false;
      }
    },
  );
}

/** Пересобирает PAC-скрипт после изменения правил. */
async function reapplyProxyRules(): Promise<void> {
  if ((await getCurrentState()) !== ConnectionState.Connected) return;
  try {
    const { proxies } = await loadProxyData();
    if (!proxies.length) return;
    await applyProxy(proxies);
  } catch (error) {
    console.error("Не удалось применить новые правила:", error);
  }
}

/**
 * Приводит сохранённое состояние в соответствие с реальным:
 * после перезапуска браузера настройки прокси сбрасываются,
 * а в хранилище остаётся «connected».
 */
async function reconcileState(): Promise<void> {
  const state = await getCurrentState();
  if (state !== ConnectionState.Connected) return;

  const controlled = await isProxyControlledByUs();
  if (!controlled) {
    console.info("Прокси не активен (настройки сброшены) — сбрасываем состояние");
    await setCurrentState(ConnectionState.Disconnected);
  }
}

// ------------------------------------------------------------------ старт

async function main(): Promise<void> {
  await setupAlarms();
  setupAlarmListener();
  setupProxyAuthListener();
  setupProxyConflictWatcher();
  setupMessageListener();

  // Иконка и пересборка PAC при изменении состояния/правил
  watchValue<ConnectionState>("local", StorageKey.ConnectionState, () => {
    void updateIcon();
  });
  watchValue("local", StorageKey.ProxyRules, () => {
    void reapplyProxyRules();
  });

  await updateIcon();
  await reconcileState();
  void checkProxyConflict();

  // идентификатор устройства создаётся заранее, чтобы первый запрос был быстрым
  await getDeviceId();

  console.info(`[VPN Наоборот] фон запущен, API: ${API_HOST}`);
}

void main();
