/**
 * Тонкая обёртка над WebExtension API: работает и с `browser.*` (Firefox),
 * и с `chrome.*` (Chrome/Edge).
 */

type AnyApi = Record<string, any>;

const globalAny = globalThis as unknown as AnyApi;

/**
 * Firefox определяем по user agent, а не по наличию глобала `browser`:
 * в Chrome этот глобал может быть определён (алиас или чужой polyfill),
 * из-за чего подсказка про приватные окна показывалась в Chrome.
 */
export const isFirefox = /firefox/i.test(globalAny.navigator?.userAgent ?? "");

/** Firefox-совместимый API, если он есть; иначе chrome.* */
export const browserApi: AnyApi = isFirefox
  ? (globalAny.browser ?? globalAny.chrome)
  : (globalAny.chrome ?? globalAny.browser);

/**
 * Вызывает API-метод и всегда возвращает промис.
 *
 * В Firefox (`browser.*`) API промис-образные, передавать callback нельзя.
 * В Chrome (`chrome.*`) работает callback-форма — она поддерживается всеми
 * версиями, поэтому используем именно её (иначе запрос ушёл бы дважды).
 */
export function callApi<T>(
  fn: (...args: any[]) => any,
  thisArg: unknown,
  args: any[] = [],
): Promise<T> {
  if (isFirefox) {
    return Promise.resolve(fn.apply(thisArg, args) as T);
  }

  return new Promise<T>((resolve, reject) => {
    try {
      fn.apply(thisArg, [
        ...args,
        (value: any) => {
          const lastError = browserApi.runtime?.lastError;
          if (lastError) reject(new Error(lastError.message));
          else resolve(value as T);
        },
      ]);
    } catch (error) {
      reject(error);
    }
  });
}

/** Отправляет сообщение в service worker. */
export function sendMessage<T = unknown>(message: unknown): Promise<T> {
  return callApi<T>(browserApi.runtime?.sendMessage, browserApi.runtime, [message]);
}
