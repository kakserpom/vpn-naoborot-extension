/** Общие типы расширения. */

import type { ConnectionState, ConflictStatus } from "./constants";

/** Прокси-сервер. */
export interface ProxyServer {
  host: string;
  port: number;
}

/** Логин/пароль для авторизации на прокси. */
export interface ProxyCredentials {
  login: string;
  password: string;
}

/** Данные подписки. */
export interface Subscription {
  email: string;
  paidUntil: string | null;
  publicRequestId: string;
  simplifiedStatus: "paid" | "blocked";
}

/** Что делать с сайтом из правил. */
export type ProxyAction = "proxy" | "direct";

/**
 * Режим выборочного проксирования:
 *  - `all`    — через прокси идёт всё, кроме сайтов с действием `direct`;
 *  - `listed` — через прокси идут только сайты из списка с действием `proxy`.
 */
export type ProxyMode = "all" | "listed";

/** Одно правило: домен и что с ним делать. */
export interface ProxyRule {
  domain: string;
  action: ProxyAction;
}

/** Настройки выборочного проксирования целиком. */
export interface ProxyRulesSettings {
  mode: ProxyMode;
  rules: ProxyRule[];
}

/** Ответ API `get_proxy`. */
export interface ProxyConfig {
  proxies: ProxyServer[];
  userProxyCredentials: ProxyCredentials;
}

/** Ответ API `user_data`. */
export interface UserDataResponse {
  data: {
    request: {
      public_request_id: string;
      paid_until: string | null;
      simplified_status: "paid" | "blocked";
    };
  };
}

/** Статус, который background отдаёт popup. */
export interface StatusSnapshot {
  state: ConnectionState;
  conflict: ConflictStatus;
}

/** Шаг авторизации. */
export type AuthStep = "email" | "otp";

/** Состояние шага авторизации. */
export interface AuthStepState {
  step: AuthStep;
  email: string;
}
