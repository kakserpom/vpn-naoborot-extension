/** Идентификатор и внешний IP устройства. */

import { DEVICE_IP_TIMEOUT_MS, DEVICE_IP_URL, StorageKey } from "../shared/constants";
import { getValue, setValue } from "../shared/storage";

/** Уникальный идентификатор установки расширения. */
export async function getDeviceId(): Promise<string> {
  const stored = await getValue<string | null>("local", StorageKey.DeviceId, null);
  if (stored) return stored;

  const id = crypto.randomUUID();
  await setValue("local", StorageKey.DeviceId, id);
  return id;
}

/** Внешний IP устройства (кэшируется). */
export async function getDeviceIp(): Promise<string | undefined> {
  const stored = await getValue<string | null>("local", StorageKey.DeviceIp, null);
  if (stored) return stored;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEVICE_IP_TIMEOUT_MS);
    try {
      const response = await fetch(DEVICE_IP_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { ip?: string };
      if (!data.ip) throw new Error("В ответе нет поля ip");
      await setValue("local", StorageKey.DeviceIp, data.ip);
      return data.ip;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn("Не удалось определить внешний IP:", error);
    return undefined;
  }
}
