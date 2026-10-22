/**
 * Типизированная обёртка над `storage.local` / `storage.session`.
 */

import { browserApi, callApi } from "./browser";

export type StorageArea = "local" | "session";

function area(name: StorageArea): any {
  const api = browserApi.storage?.[name];
  if (!api) throw new Error(`storage.${name} недоступен`);
  return api;
}

/** Читает значение; при отсутствии возвращает `fallback`. */
export async function getValue<T>(areaName: StorageArea, key: string, fallback: T): Promise<T> {
  try {
    const result = await callApi<Record<string, unknown>>(
      area(areaName).get,
      area(areaName),
      [key],
    );
    const value = result?.[key];
    return value === undefined || value === null ? fallback : (value as T);
  } catch {
    return fallback;
  }
}

/** Записывает значение. */
export async function setValue<T>(
  areaName: StorageArea,
  key: string,
  value: T,
): Promise<void> {
  await callApi<void>(area(areaName).set, area(areaName), [{ [key]: value }]);
}

/** Удаляет значение. */
export async function removeValue(areaName: StorageArea, key: string): Promise<void> {
  await callApi<void>(area(areaName).remove, area(areaName), [key]);
}

/**
 * Подписывается на изменения значения. Возвращает функцию отписки.
 */
export function watchValue<T>(
  areaName: StorageArea,
  key: string,
  callback: (value: T | undefined) => void,
): () => void {
  const onChanged = browserApi.storage?.onChanged;
  if (!onChanged?.addListener) return () => {};

  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    changeArea: string,
  ) => {
    if (changeArea !== areaName) return;
    const change = changes?.[key];
    if (!change) return;
    callback(change.newValue as T | undefined);
  };

  onChanged.addListener(listener);
  return () => onChanged.removeListener?.(listener);
}

/** Firefox: разрешить доступ к session-storage из popup. */
export async function allowSessionStorageInPopup(): Promise<void> {
  try {
    await callApi<void>(browserApi.storage?.session?.setAccessLevel, browserApi.storage?.session, [
      { accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" },
    ]);
  } catch {
    /* в Chrome session storage и так доступен всем контекстам расширения */
  }
}
