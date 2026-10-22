/**
 * HTTP-клиент к API расширения.
 *
 * Основной хост — `naoborot-api.naoinfrastructure.com`. Если он недоступен,
 * перебираются субдомены-поды (`0.…`, `1.…` … `9.…`) — так же, как в прошлой
 * версии расширения. Индекс рабочего хоста запоминается, чтобы не перебирать
 * его заново при каждом запросе.
 */

import { API_HOST, API_PATH, API_TIMEOUT_MS, MAX_FALLBACK_INDEX, StorageKey } from "./constants";
import { getValue, setValue } from "./storage";

/** Ошибка сетевого уровня (сервер недоступен, таймаут) — можно пробовать другой хост. */
export class NetworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NetworkError";
  }
}

/** Ошибка HTTP (сервер ответил, но с ошибкой). */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface RequestOptions {
  json?: unknown;
  searchParams?: Record<string, string | number | undefined>;
  timeout?: number;
}

/** Список хостов в порядке перебора: null (основной) + субдомены. */
function buildHostOrder(currentIndex: number | null): (number | null)[] {
  const hosts: (number | null)[] = [null];
  for (let i = 0; i < MAX_FALLBACK_INDEX; i++) hosts.push(i);
  if (currentIndex === null || currentIndex === undefined) return hosts;
  const offset = currentIndex + 1;
  return [...hosts.slice(offset), ...hosts.slice(0, offset)];
}

/** URL для конкретного хоста. */
export function buildApiUrl(subdomainIndex: number | null, path: string): string {
  const host = subdomainIndex === null ? API_HOST : `${subdomainIndex}.${API_HOST}`;
  return `https://${host}${API_PATH}${path.replace(/^\//, "")}`;
}

async function requestOnce(
  url: string,
  method: string,
  options: RequestOptions,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? API_TIMEOUT_MS);

  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.json ? { "Content-Type": "application/json" } : {}),
      },
    };
    if (options.json !== undefined) init.body = JSON.stringify(options.json);

    let urlWithQuery = url;
    if (options.searchParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.searchParams)) {
        if (value !== undefined) params.set(key, String(value));
      }
      const query = params.toString();
      if (query) urlWithQuery += (urlWithQuery.includes("?") ? "&" : "?") + query;
    }

    const response = await fetch(urlWithQuery, init);

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 300);
      } catch {
        /* тело может отсутствовать */
      }
      throw new ApiError(
        `HTTP ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
        response.status,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new NetworkError(`Таймаут запроса к ${url}`, { cause: error });
    }
    throw new NetworkError(`Сеть недоступна: ${url}`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Выполняет запрос к API, при недоступности хоста перебирает поды.
 * Ошибки HTTP пробрасываются сразу — это ответ сервера, а не сети.
 */
export async function apiRequest<T>(
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const cachedIndex = await getValue<number | null>("local", StorageKey.ApiHostIndex, null);
  const order = buildHostOrder(cachedIndex);

  let lastError: unknown;
  for (const subdomainIndex of order) {
    const url = buildApiUrl(subdomainIndex, path);
    try {
      const result = await requestOnce(url, method.toUpperCase(), options);
      await setValue("local", StorageKey.ApiHostIndex, subdomainIndex);
      return result as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      lastError = error;
    }
  }

  await setValue("local", StorageKey.ApiHostIndex, null);
  throw lastError instanceof Error ? lastError : new Error("API недоступен");
}
