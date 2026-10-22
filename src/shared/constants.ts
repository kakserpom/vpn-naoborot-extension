/**
 * Общие константы расширения: адреса API, ключи хранилища, состояния соединения.
 * Используются и в service worker, и в popup.
 */

/** Базовый хост API (без субдомена). */
export const API_HOST = "naoborot-api.naoinfrastructure.com";
/** Префикс пути API. */
export const API_PATH = "/api/v1/";
/** Сколько субдоменов-продов перебираем, если основной хост недоступен. */
export const MAX_FALLBACK_INDEX = 10;
/** Таймаут запросов к API, мс. */
export const API_TIMEOUT_MS = 30_000;
/** Таймаут запроса внешнего IP, мс. */
export const DEVICE_IP_TIMEOUT_MS = 5_000;
/** Служба определения внешнего IP. */
export const DEVICE_IP_URL = "https://api.ipify.org?format=json";

/** Периодическое обновление списка прокси, мин. */
export const PROXY_REFRESH_MINUTES = 30;
/** Периодическое обновление данных подписки, мин. */
export const SUBSCRIPTION_REFRESH_MINUTES = 60;

/** Имена будильников. */
export const AlarmName = {
  UpdateProxyData: "update-proxy-data",
  UpdateSubscriptionData: "update-subscription-data",
} as const;

/** Состояние соединения с прокси. */
export const ConnectionState = {
  Connected: "connected",
  Disconnected: "disconnected",
  Connecting: "connecting",
  Error: "error",
} as const;

export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];

/** Статус конфликта с другим расширением, управляющим прокси. */
export const ConflictStatus = {
  None: "none",
  Detected: "detected",
} as const;

export type ConflictStatus = (typeof ConflictStatus)[keyof typeof ConflictStatus];

/** Ключи хранилища. */
export const StorageKey = {
  /** local: данные подписки пользователя. */
  Subscription: "subscription",
  /** local: логин/пароль для прокси. */
  ProxyCredentials: "proxyCredentials",
  /** session: список прокси-серверов. */
  ProxyList: "proxyList",
  /** local: правила выборочного проксирования. */
  ProxyRules: "proxyRules",
  /** local: состояние соединения. */
  ConnectionState: "connectionState",
  /** local: конфликт с другим расширением. */
  ConflictStatus: "conflictStatus",
  /** local: идентификатор устройства. */
  DeviceId: "deviceId",
  /** local: внешний IP устройства. */
  DeviceIp: "deviceIp",
  /** local: индекс рабочего хоста API (для fallback). */
  ApiHostIndex: "apiHostIndex",
  /** session: шаг авторизации (email → otp). */
  AuthStep: "authStep",
} as const;

/** Сообщения popup → background. */
export const MessageType = {
  ToggleProxy: "toggleProxy",
  EnableProxy: "enableProxy",
  DisableProxy: "disableProxy",
  GetStatus: "getStatus",
  RulesChanged: "rulesChanged",
} as const;

/** Ссылка на оплату подписки. */
export const SUBSCRIPTION_FORM_URL = "https://www.vpn-naoborot.com/subscription-form";
/** Тариф, предлагаемый по умолчанию. */
export const DEFAULT_TARIFF_ID = "video";
/** Почта поддержки. */
export const SUPPORT_EMAIL = "support@vpn-naoborot.online";
/** Telegram-канал поддержки. */
export const SUPPORT_TELEGRAM = "https://t.me/vpnnaoborot";
