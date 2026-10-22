/**
 * Кнопка «i» и окно с технической информацией:
 * адреса прокси-серверов, логин, состояние соединения, режим,
 * используемый хост API, данные устройства и версия расширения.
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { ConnectionState } from "../../shared/constants";
import type { ProxyRulesSettings } from "../../shared/types";
import type { TechnicalInfo } from "../lib/state";
import { Button, Modal } from "./ui";

export function InfoButton(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label="Техническая информация"
      title="Техническая информация"
      class="flex size-7 items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <svg class="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
        <path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
      </svg>
    </button>
  );
}

const STATE_LABELS: Record<string, string> = {
  [ConnectionState.Connected]: "Подключено",
  [ConnectionState.Connecting]: "Подключение…",
  [ConnectionState.Disconnected]: "Отключено",
  [ConnectionState.Error]: "Ошибка",
};

function Row(props: { label: string; children: JSX.Element }) {
  return (
    <div class="flex items-baseline justify-between gap-3">
      <span class="shrink-0 text-muted-foreground">{props.label}</span>
      <span class="min-w-0 truncate text-right">{props.children}</span>
    </div>
  );
}

/** Значение, которое не влезает в строку — выводится под подписью. */
function BlockRow(props: { label: string; children: JSX.Element }) {
  return (
    <div class="flex flex-col gap-0.5">
      <span class="text-muted-foreground">{props.label}</span>
      <span class="font-mono text-xs break-all">{props.children}</span>
    </div>
  );
}

export function InfoDialog(props: {
  open: boolean;
  onClose: () => void;
  info: TechnicalInfo;
  state: ConnectionState;
  rules: ProxyRulesSettings;
}) {
  const [copied, setCopied] = createSignal(false);

  const summary = () =>
    [
      `Прокси: ${props.info.proxies.join(", ") || "—"}`,
      `Логин: ${props.info.proxyLogin || "—"}`,
      `Состояние: ${STATE_LABELS[props.state] ?? props.state}`,
      `Режим: ${props.rules.mode === "listed" ? "только из списка" : "все сайты"} (правил: ${props.rules.rules.length})`,
      `API: ${props.info.apiHost}`,
      `Внешний IP: ${props.info.deviceIp || "—"}`,
      `ID устройства: ${props.info.deviceId || "—"}`,
      `Версия: ${props.info.version || "—"}`,
    ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Не удалось скопировать:", error);
    }
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Техническая информация"
      footer={
        <Button variant="secondary" onClick={copy}>
          {copied() ? "Скопировано" : "Скопировать"}
        </Button>
      }
    >
      <div class="flex flex-col gap-2 text-sm">
        <Row label="Состояние">{STATE_LABELS[props.state] ?? props.state}</Row>

        <div class="flex flex-col gap-0.5">
          <span class="text-muted-foreground">Прокси-серверы</span>
          <Show
            when={props.info.proxies.length > 0}
            fallback={<span class="text-muted-foreground">нет данных</span>}
          >
            <ul class="flex flex-col gap-0.5">
              <For each={props.info.proxies}>
                {(proxy, index) => (
                  <li class="font-mono text-xs break-all" title={proxy}>
                    {index() + 1}. {proxy}
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>

        <Row label="Логин прокси">{props.info.proxyLogin || "—"}</Row>

        <Row label="Режим">
          {props.rules.mode === "listed" ? "только из списка" : "все сайты"}
        </Row>
        <Row label="Правил">{props.rules.rules.length}</Row>

        <BlockRow label="API">{props.info.apiHost}</BlockRow>

        <Row label="Внешний IP">{props.info.deviceIp || "—"}</Row>

        <BlockRow label="ID устройства">{props.info.deviceId || "—"}</BlockRow>

        <Row label="Версия">{props.info.version || "—"}</Row>
      </div>
    </Modal>
  );
}
