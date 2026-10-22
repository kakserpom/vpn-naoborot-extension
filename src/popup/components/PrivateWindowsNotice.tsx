/**
 * Подсказка для Firefox: для управления прокси нужен доступ к приватным окнам.
 *
 * Показывается только в Firefox и только если расширение реально не имеет
 * доступа к приватным окнам (иначе подсказка лишняя).
 */

import { Show, createSignal, onMount } from "solid-js";
import { browserApi, isFirefox } from "../../shared/browser";

export function PrivateWindowsNotice() {
  const [needed, setNeeded] = createSignal(false);

  onMount(() => {
    if (!isFirefox) return;
    void (async () => {
      try {
        const allowed = await browserApi.extension?.isAllowedIncognitoAccess?.();
        setNeeded(allowed === false);
      } catch {
        setNeeded(false);
      }
    })();
  });

  return (
    <Show when={needed()}>
      <div class="w-full rounded-lg border bg-muted/50 p-3 text-sm">
        <div class="mb-1 text-center font-semibold">Требуется доступ в приватных окнах</div>
        <div class="text-pretty">
          Для изменения настроек прокси расширению необходим доступ к приватным окнам.
        </div>
        <ol class="mt-2 ml-4 list-decimal space-y-1 text-pretty">
          <li>
            Откройте <code class="rounded bg-gray-200 px-1 py-0.5 text-gray-600">about:addons</code>{" "}
            в адресной строке
          </li>
          <li>
            Во вкладке «Расширения» найдите «<strong>VPN Наоборот</strong>»
          </li>
          <li>Включите «Разрешить доступ к приватным окнам»</li>
        </ol>
      </div>
    </Show>
  );
}
